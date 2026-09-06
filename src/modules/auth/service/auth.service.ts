import {
  Injectable,
  Logger,
  UnauthorizedException,
  InternalServerErrorException,
  BadRequestException,
  NotFoundException,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, MoreThan } from 'typeorm';
import {
  createHash,
  createHmac,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';
import { I18nService } from 'nestjs-i18n';
import { firstValueFrom } from 'rxjs';
import { LoginDto } from '@auth/dto/login.dto';
import { RefreshTokenDto } from '@auth/dto/refresh-token.dto';
import { ChangePasswordDto } from '@auth/dto/change-password.dto';
import { SessionResponseDto } from '@auth/dto/session-response.dto';
import { EventResponseDto } from '@auth/dto/event-response.dto';
import {
  KeycloakAdminService,
  KeycloakAdminError,
} from '@auth/service/keycloak-admin.service';
import { IntrospectResponse } from '@auth/interfaces/IntrospectResponse.dto';
import { KeycloakTokenResponse } from '@auth/interfaces/KeycloakTokenResponse.dto';
import { UserRepository } from '@identity/repositories/app-user.repositories';
import { EncryptionService } from '@shared/services/encryption.service';
import { IpBlockService } from '@shared/services/ip-block.service';
import { PasswordResetOtp } from '@auth/entities/password-reset-otp.entity';
import { MailService } from '@mail/service/mail.service';

const OTP_TTL_MS = 10 * 60 * 1000; // 10 min
const OTP_MAX_ATTEMPTS = 3;
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 min

interface KeycloakIntrospectResponse {
  active: boolean;
  exp?: number;
  iat?: number;
  sub?: string;
  preferred_username?: string;
  email?: string;
  realm_access?: { roles?: string[] };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  private readonly baseUrl: string;
  private readonly realm: string;
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly keycloakAdminService: KeycloakAdminService,
    @Inject(forwardRef(() => UserRepository))
    private readonly userRepository: UserRepository,
    @Inject(I18nService) private readonly i18n: I18nService,
    private readonly encryptionService: EncryptionService,
    private readonly ipBlockService: IpBlockService,
    @InjectRepository(PasswordResetOtp)
    private readonly otpRepo: Repository<PasswordResetOtp>,
    @Inject(forwardRef(() => MailService))
    private readonly mailService: MailService,
  ) {
    this.baseUrl = this.configService.get<string>('KEYCLOAK_URL')!;
    this.realm = this.configService.get<string>('KEYCLOAK_REALM')!;
    this.clientId = this.configService.get<string>('KEYCLOAK_CLIENT_ID')!;
    this.clientSecret = this.configService.get<string>('KEYCLOAK_SECRET')!;
  }

  private get tokenUrl(): string {
    return `${this.baseUrl}/realms/${this.realm}/protocol/openid-connect/token`;
  }

  // ─────────────────────────────────────────────────────────────
  // LOGIN — Resource Owner Password Credentials (ROPC)
  // ─────────────────────────────────────────────────────────────

  async login(dto: LoginDto, ip: string): Promise<KeycloakTokenResponse> {
    if (!this.encryptionService.isEncrypted(dto.password)) {
      throw new BadRequestException(
        this.i18n.t('auth.CREDENTIALS_INVALID') +
          ' La contraseña debe estar encriptada con AES-256-GCM. Usa POST /auth/encrypt.',
      );
    }

    const password = this.encryptionService.decrypt(dto.password, 'identity');

    const body = new URLSearchParams({
      grant_type: 'password',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      username: dto.username,
      password,
    });

    try {
      const response = await firstValueFrom(
        this.httpService.post<KeycloakTokenResponse>(
          this.tokenUrl,
          body.toString(),
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          },
        ),
      );
      this.logger.log(`Login exitoso para: ${dto.username}`);
      await this.ipBlockService.resetAttempts(ip);

      const user = await this.userRepository.findByUsername(dto.username);
      const data = response.data;
      data.userId = Number.parseInt(user.id, 10);

      // Snapshot de roles desde el access_token (JWT payload) + last_login_at
      let roles: string[] = Array.isArray(user.roles) ? user.roles : [];
      try {
        const payloadPart = data.access_token?.split('.')?.[1];
        if (payloadPart) {
          const payload = JSON.parse(
            Buffer.from(payloadPart, 'base64url').toString('utf8'),
          ) as { realm_access?: { roles?: string[] } };
          if (payload?.realm_access?.roles?.length) {
            roles = payload.realm_access.roles.filter(
              (r) => r === 'user' || r === 'admin',
            );
            if (!roles.includes('user')) roles.push('user');
          }
        }
      } catch {
        // ignore JWT parse errors; keep previous snapshot
      }
      await this.userRepository.recordLogin(user.id, roles);

      return data;
    } catch (error: unknown) {
      const err = error as KeycloakAdminError;
      const status = err?.response?.status;
      if (status === 401 || status === 400) {
        const { blocked, remainingAttempts } =
          await this.ipBlockService.recordFailedAttempt(ip);
        this.logger.warn(
          `Login fallido para: ${dto.username} desde IP ${ip} (${remainingAttempts} intentos restantes${blocked ? ', IP bloqueada' : ''})`,
        );
        throw new UnauthorizedException(
          this.i18n.t('auth.CREDENTIALS_INVALID'),
        );
      }
      this.logger.error('[login]', err?.response?.data);
      throw new InternalServerErrorException(
        this.i18n.t('auth.KEYCLOAK_AUTH_ERROR'),
      );
    }
  }
  async refresh(
    refreshTokenDto: RefreshTokenDto,
  ): Promise<KeycloakTokenResponse> {
    if (!refreshTokenDto.refresh_token) {
      throw new UnauthorizedException(this.i18n.t('auth.SESSION_EXPIRED'));
    }
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: refreshTokenDto.refresh_token,
    });

    try {
      const response = await firstValueFrom(
        this.httpService.post<KeycloakTokenResponse>(
          this.tokenUrl,
          body.toString(),
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          },
        ),
      );
      const data = response.data;
      try {
        const payloadPart = data.access_token?.split('.')?.[1];
        if (payloadPart) {
          const payload = JSON.parse(
            Buffer.from(payloadPart, 'base64url').toString('utf8'),
          ) as { preferred_username?: string };
          if (payload?.preferred_username) {
            const user = await this.userRepository.findByUsername(
              payload.preferred_username,
            );
            data.userId = Number.parseInt(user.id, 10);
          }
        }
      } catch {
        // ignore JWT parse errors; userId queda undefined
      }
      return data;
    } catch (error: unknown) {
      const err = error as KeycloakAdminError;
      const status = err?.response?.status;
      if (status === 400 || status === 401) {
        throw new UnauthorizedException(this.i18n.t('auth.SESSION_EXPIRED'));
      }
      this.logger.error('[refresh]', err?.response?.data);
      throw new InternalServerErrorException(this.i18n.t('auth.REFRESH_ERROR'));
    }
  }

  // ─────────────────────────────────────────────────────────────
  // LOGOUT — revoca el refresh token en Keycloak
  // ─────────────────────────────────────────────────────────────

  async logout(refreshToken: string): Promise<void> {
    const url = `${this.baseUrl}/realms/${this.realm}/protocol/openid-connect/logout`;
    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: refreshToken,
    });

    try {
      await firstValueFrom(
        this.httpService.post(url, body.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
      );
      this.logger.log('Sesión cerrada en Keycloak.');
    } catch (error: unknown) {
      const err = error as KeycloakAdminError;
      this.logger.error('[logout]', err?.response?.data);
      throw new InternalServerErrorException(this.i18n.t('auth.LOGOUT_ERROR'));
    }
  }

  // ─────────────────────────────────────────────────────────────
  // FORGOT PASSWORD — genera un código OTP y lo envía por email
  // (react.email). Reemplaza el flujo execute-actions-email de Keycloak.
  // No revela si el correo existe: responde 204 igualmente.
  // ─────────────────────────────────────────────────────────────

  async forgotPassword(email: string): Promise<void> {
    let keycloakId: string;
    try {
      keycloakId = await this.keycloakAdminService.findKeycloakIdByEmail(email);
    } catch {
      this.logger.warn(
        `Recuperación solicitada para email no registrado: ${email}`,
      );
      return;
    }

    const user = await this.userRepository.findByExternalId(keycloakId);
    if (!user) {
      this.logger.warn(
        `Email ${email} existe en Keycloak pero no en app_user; no se envía OTP.`,
      );
      return;
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const codeHash = createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    this.logger.log(
      `[forgotPassword] codeHash=${codeHash} userId=${user.id} email=${email}`,
    );

    // Invalida códigos previos no consumidos del mismo usuario.
    await this.otpRepo.update(
      { user_id: Number(user.id), consumed_at: IsNull() },
      { consumed_at: new Date() },
    );
    await this.otpRepo.save(
      this.otpRepo.create({
        user_id: Number(user.id),
        code_hash: codeHash,
        expires_at: expiresAt,
      }),
    );

    await this.mailService.sendOtp(email, code, user.username ?? undefined);
    this.logger.log(`OTP generado y enviado a: ${email}`);
  }

  /**
   * Valida el código OTP. En caso de éxito devuelve un token de reset
   * (firma HMAC con expiración) para poder cambiar la contraseña sin
   * autenticarse.
   */
  async verifyOtp(
    email: string,
    code: string,
  ): Promise<{ reset_token: string; expires_in_seconds: number }> {
    this.logger.log(`[verifyOtp] email=${email}`);
    const user = await this.findUserByEmail(email);
    this.logger.log(
      `[verifyOtp] userId=${user.id} external_id=${user.external_id}`,
    );

    const otp = await this.otpRepo.findOne({
      where: {
        user_id: Number(user.id),
        consumed_at: IsNull(),
        expires_at: MoreThan(new Date()),
      },
      order: { created_at: 'DESC' },
    });

    this.logger.log(
      `[verifyOtp] otp found=${!!otp} otp_id=${otp?.id} expires_at=${otp?.expires_at?.toISOString() ?? null} consumed_at=${otp?.consumed_at?.toISOString() ?? null} attempts=${otp?.attempts}`,
    );

    const expectedHash = createHash('sha256').update(code).digest('hex');
    const matches = otp ? this.safeEqual(expectedHash, otp.code_hash) : false;
    this.logger.log(`[verifyOtp] matches=${matches}`);
    if (!otp || !matches) {
      if (otp) {
        otp.attempts += 1;
        if (otp.attempts >= OTP_MAX_ATTEMPTS) {
          otp.consumed_at = new Date();
          await this.otpRepo.save(otp);
          throw new BadRequestException(
            this.i18n.t('auth.OTP_ATTEMPTS_EXCEEDED'),
          );
        }
        await this.otpRepo.save(otp);
      }
      throw new BadRequestException(this.i18n.t('auth.OTP_INVALID'));
    }

    otp.consumed_at = new Date();
    await this.otpRepo.save(otp);

    const expiresAt = Date.now() + RESET_TOKEN_TTL_MS;
    return {
      reset_token: this.signResetToken(Number(user.id), expiresAt),
      expires_in_seconds: Math.floor(RESET_TOKEN_TTL_MS / 1000),
    };
  }

  /**
   * Cambia la contraseña en Keycloak usando el token de reset obtenido tras
   * verificar el OTP. El token es de un solo uso (el OTP ya fue consumido).
   */
  async resetPassword(
    email: string,
    resetToken: string,
    newPassword: string,
  ): Promise<void> {
    const userId = this.verifyResetToken(resetToken);
    const user = await this.userRepository.findById(String(userId));
    if (!user.external_id) {
      throw new InternalServerErrorException(
        this.i18n.t('auth.KEYCLOAK_ID_MISSING'),
      );
    }

    await this.keycloakAdminService.changePassword(
      user.external_id,
      newPassword,
    );

    // Consume cualquier OTP pendiente del usuario.
    await this.otpRepo.update(
      { user_id: Number(user.id), consumed_at: IsNull() },
      { consumed_at: new Date() },
    );

    this.logger.log(`Contraseña restablecida vía OTP para usuario: ${userId}`);
  }

  private async findUserByEmail(email: string) {
    const keycloakId =
      await this.keycloakAdminService.findKeycloakIdByEmail(email);
    const user = await this.userRepository.findByExternalId(keycloakId);
    if (!user) {
      throw new NotFoundException(this.i18n.t('auth.USER_NOT_FOUND'));
    }
    return user;
  }

  // ── Token de reset (HMAC) ──────────────────────────────────

  private get resetSecret(): string {
    const secret = this.configService.get<string>('OTP_SECRET');
    if (!secret) {
      throw new Error(
        'OTP_SECRET debe definirse para firmar tokens de reset.',
      );
    }
    return secret;
  }

  private signResetToken(userId: number, expiresAt: number): string {
    const payload = `${userId}.${expiresAt}`;
    const sig = createHmac('sha256', this.resetSecret)
      .update(payload)
      .digest('hex');
    return `${payload}.${sig}`;
  }

  private verifyResetToken(token: string): number {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new BadRequestException(this.i18n.t('auth.RESET_TOKEN_INVALID'));
    }
    const [userIdStr, expiresAtStr, sig] = parts;
    const payload = `${userIdStr}.${expiresAtStr}`;
    const expected = createHmac('sha256', this.resetSecret)
      .update(payload)
      .digest('hex');

    if (!this.safeEqual(expected, sig)) {
      throw new BadRequestException(this.i18n.t('auth.RESET_TOKEN_INVALID'));
    }
    const expiresAt = Number(expiresAtStr);
    if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
      throw new BadRequestException(this.i18n.t('auth.RESET_TOKEN_INVALID'));
    }
    const userId = Number(userIdStr);
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new BadRequestException(this.i18n.t('auth.RESET_TOKEN_INVALID'));
    }
    return userId;
  }

  private safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }

  // ─────────────────────────────────────────────────────────────
  // ENCRYPT — encripta una contraseña con AES-256-GCM
  // ─────────────────────────────────────────────────────────────

  encryptPassword(plainPassword: string): string {
    try {
      return this.encryptionService.encrypt(plainPassword, 'identity');
    } catch (error) {
      this.logger.error('[encrypt]', (error as Error).message);
      throw new BadRequestException(this.i18n.t('auth.ENCRYPT_ERROR'));
    }
  }

  // ─────────────────────────────────────────────────────────────
  // INTROSPECT — valida vigencia del access_token contra Keycloak
  // ─────────────────────────────────────────────────────────────

  async introspect(accessToken: string): Promise<IntrospectResponse> {
    const url = `${this.baseUrl}/realms/${this.realm}/protocol/openid-connect/token/introspect`;
    const body = new URLSearchParams({
      token: accessToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    let data: KeycloakIntrospectResponse;

    try {
      const response = await firstValueFrom(
        this.httpService.post<KeycloakIntrospectResponse>(
          url,
          body.toString(),
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          },
        ),
      );
      data = response.data;
    } catch (error: unknown) {
      const err = error as KeycloakAdminError;
      const kcData = err?.response?.data;
      const errMsg = kcData
        ? JSON.stringify(kcData)
        : (err?.message as string) || String(error);
      this.logger.error('[introspect] Keycloak error:', errMsg);
      throw new InternalServerErrorException(
        this.i18n.t('auth.KEYCLOAK_INTROSPECT_ERROR'),
      );
    }

    if (!data.active) {
      throw new UnauthorizedException(this.i18n.t('auth.TOKEN_EXPIRED'));
    }

    const now = Math.floor(Date.now() / 1000);
    const expiresInSeconds = data.exp ? data.exp - now : undefined;

    if (!data.preferred_username) {
      throw new UnauthorizedException(this.i18n.t('auth.TOKEN_EXPIRED'));
    }

    const user = await this.userRepository.findByUsername(
      data.preferred_username,
    );

    return {
      active: true,
      exp: data.exp,
      iat: data.iat,
      sub: data.sub,
      username: data.preferred_username,
      email: data.email,
      realm_access: data.realm_access
        ? { roles: data.realm_access.roles ?? [] }
        : undefined,
      expires_in_seconds: expiresInSeconds,
      userId: Number.parseInt(user.id, 10),
      locale: user.locale,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // CHANGE PASSWORD — cambia la contraseña del usuario autenticado
  // ─────────────────────────────────────────────────────────────

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.userRepository.findById(userId);

    if (!user.external_id) {
      throw new InternalServerErrorException(
        this.i18n.t('auth.KEYCLOAK_ID_MISSING'),
      );
    }

    const isValid = await this.keycloakAdminService.verifyPassword(
      user.username,
      dto.currentPassword,
    );

    if (!isValid) {
      throw new BadRequestException(
        this.i18n.t('auth.CURRENT_PASSWORD_INVALID'),
      );
    }

    await this.keycloakAdminService.changePassword(
      user.external_id,
      dto.newPassword,
    );
    this.logger.log(`Contrasena cambiada para usuario: ${userId}`);
  }

  // ─────────────────────────────────────────────────────────────
  // GET ACTIVE SESSIONS — lista las sesiones activas en Keycloak
  // ─────────────────────────────────────────────────────────────

  async getActiveSessions(userId: string): Promise<SessionResponseDto[]> {
    const user = await this.userRepository.findById(userId);

    if (!user.external_id) {
      throw new InternalServerErrorException(
        this.i18n.t('auth.KEYCLOAK_ID_MISSING'),
      );
    }

    const sessions = await this.keycloakAdminService.getUserSessions(
      user.external_id,
    );

    return sessions.map(
      (s) =>
        new SessionResponseDto({
          id: s.id,
          ipAddress: s.ipAddress,
          browser: s.clients?.join(', ') ?? '',
          start: String(s.start),
          lastAccess: s.lastAccess != null ? String(s.lastAccess) : null,
        }),
    );
  }

  // ─────────────────────────────────────────────────────────────
  // REVOKE SESSION — cierra una sesión específica
  // ─────────────────────────────────────────────────────────────

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);

    if (!user.external_id) {
      throw new InternalServerErrorException(
        this.i18n.t('auth.KEYCLOAK_ID_MISSING'),
      );
    }

    const sessions = await this.keycloakAdminService.getUserSessions(
      user.external_id,
    );

    if (!sessions.some((s) => s.id === sessionId)) {
      throw new NotFoundException(this.i18n.t('auth.SESSION_NOT_FOUND'));
    }

    await this.keycloakAdminService.revokeSession(sessionId);
    this.logger.log(`Sesion revocada: ${sessionId}`);
  }

  // ─────────────────────────────────────────────────────────────
  // GET ACCESS HISTORY — obtiene eventos de acceso desde Keycloak
  // ─────────────────────────────────────────────────────────────

  async getAccessHistory(userId: string): Promise<EventResponseDto[]> {
    const user = await this.userRepository.findById(userId);

    if (!user.external_id) {
      throw new InternalServerErrorException(
        this.i18n.t('auth.KEYCLOAK_ID_MISSING'),
      );
    }

    const events = await this.keycloakAdminService.getUserEvents(
      user.external_id,
    );

    return events.map(
      (e) =>
        new EventResponseDto({
          type: e.type,
          ipAddress: e.ipAddress,
          time: String(e.time),
          error: e.error ?? null,
          details: e.details ?? {},
        }),
    );
  }
}

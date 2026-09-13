import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, createHmac } from 'node:crypto';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';
import { AuthService } from '@auth/service/auth.service';
import { KeycloakAdminService } from '@auth/service/keycloak-admin.service';
import { UserRepository } from '@identity/repositories/app-user.repositories';
import { PasswordResetOtp } from '@auth/entities/password-reset-otp.entity';
import { MailService } from '@mail/service/mail.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LoginDto } from '@auth/dto/login.dto';
import { RefreshTokenDto } from '@auth/dto/refresh-token.dto';
import { ChangePasswordDto } from '@auth/dto/change-password.dto';
import { EncryptionService } from '@shared/services/encryption.service';
import { IpBlockService } from '@shared/services/ip-block.service';
import { I18nService } from 'nestjs-i18n';

const mockHttpService = {
  post: jest.fn(),
};

const defaultConfigGet = (key: string): string | undefined => {
  const config: Record<string, string> = {
    KEYCLOAK_URL: 'http://localhost:8080',
    KEYCLOAK_REALM: 'master',
    KEYCLOAK_CLIENT_ID: 'my-nestjs-app',
    KEYCLOAK_SECRET: 'test-secret',
    OTP_SECRET: 'test-secret',
  };
  return config[key];
};

const mockConfigService = {
  get: jest.fn(defaultConfigGet),
};

const mockKeycloakAdminService = {
  createUser: jest.fn(),
  deleteUser: jest.fn(),
  findKeycloakIdByEmail: jest.fn(),
  sendResetPasswordEmail: jest.fn(),
  changePassword: jest.fn(),
  verifyPassword: jest.fn(),
  getUserSessions: jest.fn(),
  getUserEvents: jest.fn(),
  revokeSession: jest.fn(),
};

const mockUserRepository = {
  create: jest.fn(),
  findByExternalId: jest.fn(),
  findByUsername: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  recordLogin: jest.fn(),
};

const mockEncryptionService = {
  isEncrypted: jest.fn(() => true),
  decrypt: jest.fn((value: string) => value),
  encrypt: jest.fn((value: string) => value),
};

const mockIpBlockService = {
  recordFailedAttempt: jest.fn().mockResolvedValue({
    blocked: false,
    remainingAttempts: 4,
  }),
  resetAttempts: jest.fn(),
};

const mockI18nService = {
  t: jest.fn((key: string) => key),
};

const mockOtpRepo = {
  findOne: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  create: jest.fn((data: unknown) => data),
};

const mockMailService = {
  sendOtp: jest.fn(),
};

const TEST_IP = '127.0.0.1';

const axiosResponse = <T>(data: T): AxiosResponse<T> => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config: { headers: {} } as unknown as AxiosResponse<T>['config'],
});

const buildJwt = (payload: unknown): string =>
  `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.sig`;

const sha256 = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: KeycloakAdminService, useValue: mockKeycloakAdminService },
        { provide: UserRepository, useValue: mockUserRepository },
        { provide: EncryptionService, useValue: mockEncryptionService },
        { provide: IpBlockService, useValue: mockIpBlockService },
        { provide: I18nService, useValue: mockI18nService },
        {
          provide: getRepositoryToken(PasswordResetOtp),
          useValue: mockOtpRepo,
        },
        { provide: MailService, useValue: mockMailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // LOGIN
  // ─────────────────────────────────────────────────────────────
  describe('login', () => {
    const dto: LoginDto = { username: 'testuser', password: 'pass123' };
    const tokenResponse = {
      access_token: 'abc',
      refresh_token: 'def',
      expires_in: 300,
      refresh_expires_in: 1800,
      token_type: 'Bearer',
      session_state: 'sess',
      scope: 'openid',
    };

    it('debe retornar KeycloakTokenResponse en login exitoso', async () => {
      mockUserRepository.findByUsername.mockResolvedValue({ id: '123' });
      mockHttpService.post.mockReturnValue(of(axiosResponse(tokenResponse)));
      const result = await service.login(dto, TEST_IP);
      expect(result).toEqual({ ...tokenResponse, userId: 123 });
      expect(mockHttpService.post).toHaveBeenCalledTimes(1);
      expect(mockIpBlockService.resetAttempts).toHaveBeenCalledWith(TEST_IP);
      expect(mockUserRepository.recordLogin).toHaveBeenCalledWith(
        '123',
        expect.any(Array),
      );
    });

    it('debe lanzar UnauthorizedException con credenciales inválidas (401)', async () => {
      mockHttpService.post.mockReturnValue(
        throwError(() => ({ response: { status: 401, data: {} } })),
      );
      await expect(service.login(dto, TEST_IP)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockIpBlockService.recordFailedAttempt).toHaveBeenCalledWith(
        TEST_IP,
      );
    });

    it('debe lanzar UnauthorizedException con credenciales inválidas (400)', async () => {
      mockHttpService.post.mockReturnValue(
        throwError(() => ({ response: { status: 400, data: {} } })),
      );
      await expect(service.login(dto, TEST_IP)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('debe lanzar InternalServerErrorException en error de red', async () => {
      mockHttpService.post.mockReturnValue(
        throwError(() => ({ response: { status: 500, data: {} } })),
      );
      await expect(service.login(dto, TEST_IP)).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(mockIpBlockService.recordFailedAttempt).not.toHaveBeenCalled();
    });

    it('debe lanzar BadRequestException si la contraseña no está encriptada', async () => {
      mockEncryptionService.isEncrypted.mockReturnValueOnce(false);
      await expect(service.login(dto, TEST_IP)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockHttpService.post).not.toHaveBeenCalled();
    });

    it('debe extraer roles del access_token y garantizar el rol user', async () => {
      mockUserRepository.findByUsername.mockResolvedValue({ id: '123' });
      mockHttpService.post.mockReturnValue(
        of(
          axiosResponse({
            ...tokenResponse,
            access_token: buildJwt({ realm_access: { roles: ['admin'] } }),
          }),
        ),
      );
      await service.login(dto, TEST_IP);
      expect(mockUserRepository.recordLogin).toHaveBeenCalledWith('123', [
        'admin',
        'user',
      ]);
    });

    it('debe filtrar roles a user/admin sin duplicar el rol user', async () => {
      mockUserRepository.findByUsername.mockResolvedValue({ id: '123' });
      mockHttpService.post.mockReturnValue(
        of(
          axiosResponse({
            ...tokenResponse,
            access_token: buildJwt({
              realm_access: { roles: ['viewer', 'operator', 'user', 'admin'] },
            }),
          }),
        ),
      );
      await service.login(dto, TEST_IP);
      expect(mockUserRepository.recordLogin).toHaveBeenCalledWith('123', [
        'user',
        'admin',
      ]);
    });

    it('debe mantener el snapshot previo si el access_token no es un JWT', async () => {
      mockUserRepository.findByUsername.mockResolvedValue({
        id: '123',
        roles: ['user'],
      });
      mockHttpService.post.mockReturnValue(
        of(axiosResponse({ ...tokenResponse, access_token: 'abc' })),
      );
      await service.login(dto, TEST_IP);
      expect(mockUserRepository.recordLogin).toHaveBeenCalledWith('123', [
        'user',
      ]);
    });

    it('debe ignorar errores al parsear el payload del JWT', async () => {
      mockUserRepository.findByUsername.mockResolvedValue({ id: '123' });
      mockHttpService.post.mockReturnValue(
        of(axiosResponse({ ...tokenResponse, access_token: 'a.%%%.c' })),
      );
      await service.login(dto, TEST_IP);
      expect(mockUserRepository.recordLogin).toHaveBeenCalledWith('123', []);
    });

    it('debe conservar el snapshot si el JWT no trae roles', async () => {
      mockUserRepository.findByUsername.mockResolvedValue({
        id: '123',
        roles: ['user'],
      });
      mockHttpService.post.mockReturnValue(
        of(
          axiosResponse({
            ...tokenResponse,
            access_token: buildJwt({ realm_access: {} }),
          }),
        ),
      );
      await service.login(dto, TEST_IP);
      expect(mockUserRepository.recordLogin).toHaveBeenCalledWith('123', [
        'user',
      ]);
    });

    it('debe registrar el intento fallido cuando la IP queda bloqueada', async () => {
      mockIpBlockService.recordFailedAttempt.mockResolvedValueOnce({
        blocked: true,
        remainingAttempts: 0,
      });
      mockHttpService.post.mockReturnValue(
        throwError(() => ({ response: { status: 401, data: {} } })),
      );
      await expect(service.login(dto, TEST_IP)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockIpBlockService.recordFailedAttempt).toHaveBeenCalledWith(
        TEST_IP,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // REFRESH
  // ─────────────────────────────────────────────────────────────
  describe('refresh', () => {
    const dto: RefreshTokenDto = { refresh_token: 'valid-refresh-token' };

    it('debe retornar nuevos tokens en refresh exitoso', async () => {
      const tokenResponse = {
        access_token: 'new-access',
        refresh_token: 'new-refresh',
      };
      mockHttpService.post.mockReturnValue(of(axiosResponse(tokenResponse)));
      const result = await service.refresh(dto);
      expect(result).toEqual(tokenResponse);
    });

    it('debe lanzar UnauthorizedException si el refresh token es inválido (401)', async () => {
      mockHttpService.post.mockReturnValue(
        throwError(() => ({ response: { status: 401, data: {} } })),
      );
      await expect(service.refresh(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('debe lanzar InternalServerErrorException en error de red', async () => {
      mockHttpService.post.mockReturnValue(
        throwError(() => ({ response: { status: 500, data: {} } })),
      );
      await expect(service.refresh(dto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('debe lanzar UnauthorizedException si no se envía refresh_token', async () => {
      await expect(service.refresh({})).rejects.toThrow(UnauthorizedException);
      expect(mockHttpService.post).not.toHaveBeenCalled();
    });

    it('debe decodificar el access_token y setear userId cuando trae preferred_username', async () => {
      const payload = Buffer.from(
        JSON.stringify({ preferred_username: 'jose.duque' }),
      ).toString('base64url');
      const tokenResponse = {
        access_token: `header.${payload}.signature`,
        refresh_token: 'new-refresh',
      };
      mockHttpService.post.mockReturnValue(of(axiosResponse(tokenResponse)));
      mockUserRepository.findByUsername.mockResolvedValue({ id: '123' });

      const result = await service.refresh(dto);

      expect(mockUserRepository.findByUsername).toHaveBeenCalledWith(
        'jose.duque',
      );
      expect(result.userId).toBe(123);
    });

    it('debe ignorar silenciosamente un access_token con payload JWT inválido', async () => {
      const tokenResponse = {
        access_token: 'header.not-valid-base64-json.signature',
        refresh_token: 'new-refresh',
      };
      mockHttpService.post.mockReturnValue(of(axiosResponse(tokenResponse)));

      const result = await service.refresh(dto);

      expect(mockUserRepository.findByUsername).not.toHaveBeenCalled();
      expect(result.userId).toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // LOGOUT
  // ─────────────────────────────────────────────────────────────
  describe('logout', () => {
    it('debe cerrar sesión correctamente', async () => {
      mockHttpService.post.mockReturnValue(of(axiosResponse({})));
      await expect(
        service.logout('valid-refresh-token'),
      ).resolves.toBeUndefined();
    });

    it('debe lanzar InternalServerErrorException en error de red', async () => {
      mockHttpService.post.mockReturnValue(
        throwError(() => ({ response: { status: 500, data: {} } })),
      );
      await expect(service.logout('token')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // FORGOT PASSWORD
  // ─────────────────────────────────────────────────────────────
  describe('forgotPassword', () => {
    it('debe enviar email de recuperación correctamente', async () => {
      mockKeycloakAdminService.findKeycloakIdByEmail.mockResolvedValue(
        'kc-id-123',
      );
      mockUserRepository.findByExternalId.mockResolvedValue({
        id: '7',
        username: 'testuser',
      });
      mockOtpRepo.update.mockResolvedValue(undefined);
      mockOtpRepo.save.mockResolvedValue({});
      await expect(
        service.forgotPassword('user@test.com'),
      ).resolves.toBeUndefined();
      expect(
        mockKeycloakAdminService.findKeycloakIdByEmail,
      ).toHaveBeenCalledWith('user@test.com');
      expect(mockMailService.sendOtp).toHaveBeenCalledWith(
        'user@test.com',
        expect.any(String),
        'testuser',
      );
    });

    it('debe ignorar silenciosamente si el email no existe en Keycloak', async () => {
      mockKeycloakAdminService.findKeycloakIdByEmail.mockRejectedValue(
        new UnauthorizedException('Email no encontrado.'),
      );
      await expect(
        service.forgotPassword('noexiste@test.com'),
      ).resolves.toBeUndefined();
      expect(mockMailService.sendOtp).not.toHaveBeenCalled();
    });

    it('debe no enviar OTP si el usuario no existe en app_user', async () => {
      mockKeycloakAdminService.findKeycloakIdByEmail.mockResolvedValue('kc-id');
      mockUserRepository.findByExternalId.mockResolvedValue(null);
      await expect(
        service.forgotPassword('ghost@test.com'),
      ).resolves.toBeUndefined();
      expect(mockOtpRepo.save).not.toHaveBeenCalled();
      expect(mockMailService.sendOtp).not.toHaveBeenCalled();
    });

    it('debe enviar OTP sin username si el usuario no lo tiene', async () => {
      mockKeycloakAdminService.findKeycloakIdByEmail.mockResolvedValue('kc-id');
      mockUserRepository.findByExternalId.mockResolvedValue({ id: '7' });
      mockOtpRepo.update.mockResolvedValue(undefined);
      mockOtpRepo.save.mockResolvedValue({});
      await service.forgotPassword('anon@test.com');
      expect(mockMailService.sendOtp).toHaveBeenCalledWith(
        'anon@test.com',
        expect.any(String),
        undefined,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // INTROSPECT
  // ─────────────────────────────────────────────────────────────
  describe('introspect', () => {
    const now = Math.floor(Date.now() / 1000);
    const activeTokenData = {
      active: true,
      exp: now + 300,
      iat: now,
      sub: 'user-uuid',
      preferred_username: 'testuser',
      email: 'test@test.com',
      realm_access: { roles: ['user'] },
    };

    it('debe retornar IntrospectResponse con token activo', async () => {
      mockUserRepository.findByUsername.mockResolvedValue({ id: '123' });
      mockHttpService.post.mockReturnValue(of(axiosResponse(activeTokenData)));
      const result = await service.introspect('valid-token');
      expect(result.active).toBe(true);
      expect(result.username).toBe('testuser');
      expect(result.email).toBe('test@test.com');
      expect(result.expires_in_seconds).toBeGreaterThan(0);
    });

    it('debe incluir el locale del app_user para que UserLocaleResolver lo use', async () => {
      mockUserRepository.findByUsername.mockResolvedValue({
        id: '123',
        locale: 'en-US',
      });
      mockHttpService.post.mockReturnValue(of(axiosResponse(activeTokenData)));
      const result = await service.introspect('valid-token');
      expect(result.locale).toBe('en-US');
    });

    it('debe lanzar UnauthorizedException si active=false', async () => {
      mockHttpService.post.mockReturnValue(
        of(axiosResponse({ active: false })),
      );
      await expect(service.introspect('expired-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('debe lanzar InternalServerErrorException en error de red', async () => {
      mockHttpService.post.mockReturnValue(
        throwError(() => ({ response: { status: 500, data: {} } })),
      );
      await expect(service.introspect('any-token')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('debe omitir expires_in_seconds y realm_access si no vienen', async () => {
      mockUserRepository.findByUsername.mockResolvedValue({ id: '123' });
      mockHttpService.post.mockReturnValue(
        of(axiosResponse({ active: true, preferred_username: 'testuser' })),
      );
      const result = await service.introspect('token');
      expect(result.expires_in_seconds).toBeUndefined();
      expect(result.realm_access).toBeUndefined();
    });

    it('debe devolver roles vacíos si realm_access no trae roles', async () => {
      mockUserRepository.findByUsername.mockResolvedValue({ id: '123' });
      mockHttpService.post.mockReturnValue(
        of(
          axiosResponse({
            active: true,
            preferred_username: 'testuser',
            realm_access: {},
          }),
        ),
      );
      const result = await service.introspect('token');
      expect(result.realm_access).toEqual({ roles: [] });
    });

    it('debe lanzar UnauthorizedException si falta preferred_username', async () => {
      mockHttpService.post.mockReturnValue(of(axiosResponse({ active: true })));
      await expect(service.introspect('token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('debe usar el mensaje del error cuando no hay respuesta de Keycloak', async () => {
      mockHttpService.post.mockReturnValue(
        throwError(() => new Error('Network down')),
      );
      await expect(service.introspect('token')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('debe tolerar errores sin data ni message', async () => {
      mockHttpService.post.mockReturnValue(throwError(() => 'raw-error'));
      await expect(service.introspect('token')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // VERIFY OTP
  // ─────────────────────────────────────────────────────────────
  describe('verifyOtp', () => {
    const user = { id: '7', external_id: 'kc-id' };
    const code = '123456';

    beforeEach(() => {
      mockKeycloakAdminService.findKeycloakIdByEmail.mockResolvedValue('kc-id');
      mockUserRepository.findByExternalId.mockResolvedValue(user);
    });

    it('debe retornar reset_token si el código es correcto', async () => {
      mockOtpRepo.findOne.mockResolvedValue({
        id: 1,
        code_hash: sha256(code),
        attempts: 0,
        expires_at: new Date(Date.now() + 100_000),
        consumed_at: null,
      });
      mockOtpRepo.save.mockResolvedValue({});
      const result = await service.verifyOtp('user@test.com', code);
      expect(result).toHaveProperty('reset_token');
      expect(result.expires_in_seconds).toBe(900);
      expect(mockOtpRepo.save).toHaveBeenCalled();
    });

    it('debe lanzar BadRequestException si no existe un OTP válido', async () => {
      mockOtpRepo.findOne.mockResolvedValue(null);
      await expect(service.verifyOtp('user@test.com', code)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockOtpRepo.save).not.toHaveBeenCalled();
    });

    it('debe incrementar intentos si el código no coincide', async () => {
      const otp = {
        id: 1,
        code_hash: sha256('000000'),
        attempts: 0,
        expires_at: new Date(Date.now() + 100_000),
        consumed_at: null,
      };
      mockOtpRepo.findOne.mockResolvedValue(otp);
      await expect(service.verifyOtp('user@test.com', code)).rejects.toThrow(
        BadRequestException,
      );
      expect(otp.attempts).toBe(1);
      expect(otp.consumed_at).toBeNull();
    });

    it('debe consumir el OTP si se superan los intentos', async () => {
      const otp = {
        id: 1,
        code_hash: sha256('000000'),
        attempts: 2,
        expires_at: new Date(Date.now() + 100_000),
        consumed_at: null,
      };
      mockOtpRepo.findOne.mockResolvedValue(otp);
      await expect(service.verifyOtp('user@test.com', code)).rejects.toThrow(
        BadRequestException,
      );
      expect(otp.attempts).toBe(3);
      expect(otp.consumed_at).not.toBeNull();
    });

    it('debe fallar si el hash almacenado tiene otra longitud', async () => {
      const otp = {
        id: 1,
        code_hash: 'short',
        attempts: 0,
        expires_at: new Date(Date.now() + 100_000),
        consumed_at: null,
      };
      mockOtpRepo.findOne.mockResolvedValue(otp);
      await expect(service.verifyOtp('user@test.com', code)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('debe lanzar NotFoundException si el email no corresponde a un usuario', async () => {
      mockUserRepository.findByExternalId.mockResolvedValue(null);
      await expect(service.verifyOtp('ghost@test.com', code)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // RESET PASSWORD
  // ─────────────────────────────────────────────────────────────
  describe('resetPassword', () => {
    const secret = 'test-secret';
    const future = Date.now() + 60_000;
    const sign = (userId: number, expiresAt: number): string => {
      const payload = `${userId}.${expiresAt}`;
      const sig = createHmac('sha256', secret).update(payload).digest('hex');
      return `${payload}.${sig}`;
    };

    afterEach(() => {
      mockConfigService.get.mockImplementation(defaultConfigGet);
    });

    it('debe cambiar la contraseña y consumir OTPs pendientes', async () => {
      mockUserRepository.findById.mockResolvedValue({
        id: '7',
        external_id: 'kc-id',
      });
      mockOtpRepo.update.mockResolvedValue(undefined);
      await expect(
        service.resetPassword('user@test.com', sign(7, future), 'Nueva.123'),
      ).resolves.toBeUndefined();
      expect(mockKeycloakAdminService.changePassword).toHaveBeenCalledWith(
        'kc-id',
        'Nueva.123',
      );
      expect(mockOtpRepo.update).toHaveBeenCalled();
    });

    it('debe lanzar InternalServerErrorException si falta external_id', async () => {
      mockUserRepository.findById.mockResolvedValue({ id: '7' });
      await expect(
        service.resetPassword('user@test.com', sign(7, future), 'Nueva.123'),
      ).rejects.toThrow(InternalServerErrorException);
      expect(mockKeycloakAdminService.changePassword).not.toHaveBeenCalled();
    });

    it('debe lanzar BadRequestException si el token no tiene el formato esperado', async () => {
      mockUserRepository.findById.mockResolvedValue({
        id: '7',
        external_id: 'kc-id',
      });
      await expect(
        service.resetPassword('user@test.com', 'token-invalido', 'Nueva.123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe lanzar BadRequestException si la firma del token no coincide', async () => {
      mockUserRepository.findById.mockResolvedValue({
        id: '7',
        external_id: 'kc-id',
      });
      await expect(
        service.resetPassword(
          'user@test.com',
          `${7}.${future}.firma-falsa`,
          'Nueva.123',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe lanzar BadRequestException si el token está expirado', async () => {
      mockUserRepository.findById.mockResolvedValue({
        id: '7',
        external_id: 'kc-id',
      });
      await expect(
        service.resetPassword(
          'user@test.com',
          sign(7, Date.now() - 60_000),
          'Nueva.123',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe lanzar BadRequestException si el userId del token no es válido', async () => {
      mockUserRepository.findById.mockResolvedValue({
        id: '7',
        external_id: 'kc-id',
      });
      await expect(
        service.resetPassword('user@test.com', sign(0, future), 'Nueva.123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe firmar tokens con OTP_SECRET cuando está configurado', async () => {
      const otpSecret = 'otp-secret-123';
      mockConfigService.get.mockImplementation((key: string) =>
        key === 'OTP_SECRET' ? otpSecret : defaultConfigGet(key),
      );
      mockUserRepository.findById.mockResolvedValue({
        id: '7',
        external_id: 'kc-id',
      });
      const payload = `7.${future}`;
      const sig = createHmac('sha256', otpSecret).update(payload).digest('hex');
      await expect(
        service.resetPassword(
          'user@test.com',
          `${payload}.${sig}`,
          'Nueva.123',
        ),
      ).resolves.toBeUndefined();
    });

    it('debe lanzar Error si falta OTP_SECRET', async () => {
      mockConfigService.get.mockImplementation((key: string) =>
        key === 'OTP_SECRET' ? undefined : defaultConfigGet(key),
      );
      await expect(
        service.resetPassword(
          'user@test.com',
          `${7}.${future}.firma-falsa`,
          'Nueva.123',
        ),
      ).rejects.toThrow(Error);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // ENCRYPT PASSWORD
  // ─────────────────────────────────────────────────────────────
  describe('encryptPassword', () => {
    it('debe encriptar la contraseña correctamente', () => {
      expect(service.encryptPassword('plain')).toBe('plain');
      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith(
        'plain',
        'identity',
      );
    });

    it('debe lanzar BadRequestException si la encriptación falla', () => {
      mockEncryptionService.encrypt.mockImplementationOnce(() => {
        throw new Error('encryption failed');
      });
      expect(() => service.encryptPassword('plain')).toThrow(
        BadRequestException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // CHANGE PASSWORD
  // ─────────────────────────────────────────────────────────────
  describe('changePassword', () => {
    const dto: ChangePasswordDto = {
      currentPassword: 'Vieja.123',
      newPassword: 'Nueva.456',
    };

    it('debe cambiar la contraseña correctamente', async () => {
      mockUserRepository.findById.mockResolvedValue({
        id: '7',
        external_id: 'kc-id',
        username: 'testuser',
      });
      mockKeycloakAdminService.verifyPassword.mockResolvedValue(true);
      mockKeycloakAdminService.changePassword.mockResolvedValue(undefined);
      await expect(service.changePassword('7', dto)).resolves.toBeUndefined();
      expect(mockKeycloakAdminService.verifyPassword).toHaveBeenCalledWith(
        'testuser',
        dto.currentPassword,
      );
      expect(mockKeycloakAdminService.changePassword).toHaveBeenCalledWith(
        'kc-id',
        dto.newPassword,
      );
    });

    it('debe lanzar InternalServerErrorException si falta external_id', async () => {
      mockUserRepository.findById.mockResolvedValue({ id: '7' });
      await expect(service.changePassword('7', dto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('debe lanzar BadRequestException si la contraseña actual es inválida', async () => {
      mockUserRepository.findById.mockResolvedValue({
        id: '7',
        external_id: 'kc-id',
        username: 'testuser',
      });
      mockKeycloakAdminService.verifyPassword.mockResolvedValue(false);
      await expect(service.changePassword('7', dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockKeycloakAdminService.changePassword).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET ACTIVE SESSIONS
  // ─────────────────────────────────────────────────────────────
  describe('getActiveSessions', () => {
    it('debe mapear las sesiones con valores por defecto', async () => {
      mockUserRepository.findById.mockResolvedValue({
        id: '7',
        external_id: 'kc-id',
      });
      mockKeycloakAdminService.getUserSessions.mockResolvedValue([
        { id: 's1', ipAddress: '10.0.0.1', start: 123, lastAccess: null },
        {
          id: 's2',
          ipAddress: '10.0.0.2',
          clients: ['app'],
          start: 456,
          lastAccess: 789,
        },
      ]);
      const result = await service.getActiveSessions('7');
      expect(result[0]).toMatchObject({
        id: 's1',
        browser: '',
        lastAccess: null,
      });
      expect(result[1]).toMatchObject({
        id: 's2',
        browser: 'app',
        lastAccess: '789',
      });
    });

    it('debe lanzar InternalServerErrorException si falta external_id', async () => {
      mockUserRepository.findById.mockResolvedValue({ id: '7' });
      await expect(service.getActiveSessions('7')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // REVOKE SESSION
  // ─────────────────────────────────────────────────────────────
  describe('revokeSession', () => {
    it('debe revocar la sesión si pertenece al usuario', async () => {
      mockUserRepository.findById.mockResolvedValue({
        id: '7',
        external_id: 'kc-id',
      });
      mockKeycloakAdminService.getUserSessions.mockResolvedValue([
        { id: 's1' },
      ]);
      mockKeycloakAdminService.revokeSession.mockResolvedValue(undefined);
      await expect(service.revokeSession('7', 's1')).resolves.toBeUndefined();
      expect(mockKeycloakAdminService.revokeSession).toHaveBeenCalledWith('s1');
    });

    it('debe lanzar NotFoundException si la sesión no pertenece al usuario', async () => {
      mockUserRepository.findById.mockResolvedValue({
        id: '7',
        external_id: 'kc-id',
      });
      mockKeycloakAdminService.getUserSessions.mockResolvedValue([
        { id: 'other' },
      ]);
      await expect(service.revokeSession('7', 's1')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockKeycloakAdminService.revokeSession).not.toHaveBeenCalled();
    });

    it('debe lanzar InternalServerErrorException si falta external_id', async () => {
      mockUserRepository.findById.mockResolvedValue({ id: '7' });
      await expect(service.revokeSession('7', 's1')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET ACCESS HISTORY
  // ─────────────────────────────────────────────────────────────
  describe('getAccessHistory', () => {
    it('debe mapear los eventos de acceso', async () => {
      mockUserRepository.findById.mockResolvedValue({
        id: '7',
        external_id: 'kc-id',
      });
      mockKeycloakAdminService.getUserEvents.mockResolvedValue([
        { type: 'LOGIN', ipAddress: '10.0.0.1', time: 123 },
        {
          type: 'LOGIN_ERROR',
          ipAddress: '10.0.0.2',
          time: 456,
          error: 'bad',
          details: { a: 1 },
        },
      ]);
      const result = await service.getAccessHistory('7');
      expect(result[0]).toMatchObject({
        type: 'LOGIN',
        error: null,
        details: {},
      });
      expect(result[1]).toMatchObject({
        type: 'LOGIN_ERROR',
        error: 'bad',
        details: { a: 1 },
      });
    });

    it('debe lanzar InternalServerErrorException si falta external_id', async () => {
      mockUserRepository.findById.mockResolvedValue({ id: '7' });
      await expect(service.getAccessHistory('7')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});

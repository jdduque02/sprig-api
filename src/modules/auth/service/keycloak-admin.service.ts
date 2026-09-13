import {
  Injectable,
  Inject,
  Logger,
  InternalServerErrorException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';
import { firstValueFrom } from 'rxjs';
import { KeycloakUserRepresentation } from '@identity/interfaces/KeycloakUserRepresentation.dto';

export interface KeycloakAdminError {
  response?: { status?: number; data?: unknown };
  message?: unknown;
}

export interface KeycloakUserSession {
  id: string;
  ipAddress: string;
  clients?: string[];
  start: number;
  lastAccess?: number;
}

export interface KeycloakUserEvent {
  type: string;
  ipAddress: string;
  time: number;
  error?: string | null;
  details?: Record<string, unknown>;
}

@Injectable()
export class KeycloakAdminService {
  private readonly logger = new Logger(KeycloakAdminService.name);

  private readonly baseUrl: string;
  private readonly realm: string;
  private readonly clientId: string;
  private readonly clientSecret: string;

  private static readonly ADMIN_TOKEN_CACHE_KEY = 'keycloak:admin_token';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    @Inject(I18nService) private readonly i18n: I18nService,
  ) {
    this.baseUrl = this.configService.get<string>('KEYCLOAK_URL')!;
    this.realm = this.configService.get<string>('KEYCLOAK_REALM')!;
    this.clientId = this.configService.get<string>('KEYCLOAK_CLIENT_ID')!;
    this.clientSecret = this.configService.get<string>('KEYCLOAK_SECRET')!;
  }

  private get adminUrl(): string {
    return `${this.baseUrl}/admin/realms/${this.realm}`;
  }

  private async getAdminToken(): Promise<string> {
    const cached = await this.cacheManager.get<string>(
      KeycloakAdminService.ADMIN_TOKEN_CACHE_KEY,
    );
    if (cached) return cached;

    const url = `${this.baseUrl}/realms/${this.realm}/protocol/openid-connect/token`;
    this.logger.debug(`[getAdminToken] clientId: ${this.clientId}`);
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    try {
      const response = await firstValueFrom(
        this.httpService.post<{ access_token: string; expires_in: number }>(
          url,
          body.toString(),
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          },
        ),
      );
      const expiresIn = response.data.expires_in ?? 60;
      const token = response.data.access_token;
      // Guarda en Redis con TTL = expires_in - 10s de buffer
      await this.cacheManager.set(
        KeycloakAdminService.ADMIN_TOKEN_CACHE_KEY,
        token,
        (expiresIn - 10) * 1000,
      );
      return token;
    } catch (error: unknown) {
      const err = error as KeycloakAdminError;
      this.logger.error(
        `[getAdminToken] Status: ${err?.response?.status} | Data: ${JSON.stringify(err?.response?.data)} | Message: ${typeof err?.message === 'string' ? err?.message : JSON.stringify(err?.message)}`,
      );
      throw new InternalServerErrorException(
        this.i18n.t('auth.KEYCLOAK_ADMIN_TOKEN_ERROR'),
      );
    }
  }

  async createUser(dto: {
    username: string;
    email: string;
    password: string;
  }): Promise<string> {
    const token = await this.getAdminToken();
    const payload: KeycloakUserRepresentation = {
      username: dto.username,
      email: dto.email,
      enabled: true,
      credentials: [
        { type: 'password', value: dto.password, temporary: false },
      ],
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.adminUrl}/users`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
      const location = response.headers['location'] as string;
      const keycloakId = location.split('/').at(-1) ?? '';
      this.logger.log(`Usuario creado en Keycloak: ${keycloakId}`);
      return keycloakId;
    } catch (error: unknown) {
      const err = error as KeycloakAdminError;
      if (err?.response?.status === 409) {
        throw new ConflictException(this.i18n.t('auth.USER_EXISTS_KEYCLOAK'));
      }
      if (err?.response?.status === 403) {
        this.logger.error(
          'Keycloak 403 Forbidden — El client no tiene permisos de administrador (realm-admin en realm-management).',
          err?.response?.data,
        );
        throw new InternalServerErrorException(
          this.i18n.t('auth.USER_REGISTER_ERROR'),
        );
      }
      this.logger.error(
        'Error al crear usuario en Keycloak',
        err?.response?.data,
      );
      throw new InternalServerErrorException(
        this.i18n.t('auth.USER_REGISTER_ERROR'),
      );
    }
  }

  /**
   * Actualiza atributos del usuario en Keycloak (email, username, etc.).
   * PUT /admin/realms/{realm}/users/{keycloakId}
   */
  async updateUser(
    keycloakId: string,
    patch: { email?: string; username?: string },
  ): Promise<void> {
    const token = await this.getAdminToken();
    try {
      await firstValueFrom(
        this.httpService.put(`${this.adminUrl}/users/${keycloakId}`, patch, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
      this.logger.log(`Usuario actualizado en Keycloak: ${keycloakId}`);
    } catch (error: unknown) {
      const err = error as KeycloakAdminError;
      if (err?.response?.status === 409) {
        throw new ConflictException(this.i18n.t('auth.USER_EXISTS_KEYCLOAK'));
      }
      if (err?.response?.status === 403) {
        this.logger.error(
          '[updateUser] Keycloak 403 Forbidden — Verificar permisos realm-admin.',
          err?.response?.data,
        );
        throw new InternalServerErrorException(
          this.i18n.t('auth.USER_UPDATE_ERROR'),
        );
      }
      this.logger.error('[updateUser]', err?.response?.data);
      throw new InternalServerErrorException(
        this.i18n.t('auth.USER_UPDATE_ERROR'),
      );
    }
  }

  async deleteUser(keycloakId: string): Promise<void> {
    const token = await this.getAdminToken();
    try {
      await firstValueFrom(
        this.httpService.delete(`${this.adminUrl}/users/${keycloakId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
      this.logger.warn(
        `Usuario eliminado de Keycloak (rollback): ${keycloakId}`,
      );
    } catch (error: unknown) {
      const err = error as KeycloakAdminError;
      if (err?.response?.status === 403) {
        this.logger.error(
          `Keycloak 403 Forbidden al eliminar usuario ${keycloakId} — Verificar permisos realm-admin.`,
          err?.response?.data,
        );
      } else {
        this.logger.error(
          `No se pudo eliminar el usuario de Keycloak: ${keycloakId}`,
          err?.response?.data,
        );
      }
    }
  }

  async findKeycloakIdByEmail(email: string): Promise<string> {
    const token = await this.getAdminToken();
    try {
      const response = await firstValueFrom(
        this.httpService.get<{ id: string }[]>(`${this.adminUrl}/users`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { email, exact: true },
        }),
      );
      const users = response.data;
      if (!users.length) {
        throw new NotFoundException(
          this.i18n.t('auth.USER_NOT_FOUND_EMAIL', { args: { email } }),
        );
      }
      return users[0].id;
    } catch (error: unknown) {
      const err = error as KeycloakAdminError;
      if (error instanceof NotFoundException) throw error;
      if (err?.response?.status === 403) {
        this.logger.error(
          '[findKeycloakIdByEmail] Keycloak 403 Forbidden — Verificar permisos realm-admin.',
          err?.response?.data,
        );
      } else {
        this.logger.error('[findKeycloakIdByEmail]', err?.response?.data);
      }
      throw new InternalServerErrorException(
        this.i18n.t('auth.USER_SEARCH_ERROR'),
      );
    }
  }

  async sendResetPasswordEmail(keycloakId: string): Promise<void> {
    const token = await this.getAdminToken();
    try {
      await firstValueFrom(
        this.httpService.put(
          `${this.adminUrl}/users/${keycloakId}/execute-actions-email`,
          ['UPDATE_PASSWORD'],
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      );
      this.logger.log(`Email de reset de contrasena enviado: ${keycloakId}`);
    } catch (error: unknown) {
      const err = error as KeycloakAdminError;
      if (err?.response?.status === 403) {
        this.logger.error(
          '[sendResetPasswordEmail] Keycloak 403 Forbidden — Verificar permisos realm-admin.',
          err?.response?.data,
        );
      } else {
        this.logger.error('[sendResetPasswordEmail]', err?.response?.data);
      }
      throw new InternalServerErrorException(
        this.i18n.t('auth.PASSWORD_RESET_ERROR'),
      );
    }
  }

  // ─────────────────────────────────────────────────────────────
  // VERIFY PASSWORD — valida credenciales actuales del usuario
  // ─────────────────────────────────────────────────────────────

  async verifyPassword(username: string, password: string): Promise<boolean> {
    const url = `${this.baseUrl}/realms/${this.realm}/protocol/openid-connect/token`;
    const body = new URLSearchParams({
      grant_type: 'password',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      username,
      password,
    });

    try {
      await firstValueFrom(
        this.httpService.post(url, body.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
      );
      return true;
    } catch (error: unknown) {
      const err = error as KeycloakAdminError;
      const status = err?.response?.status;
      if (status === 401 || status === 400) {
        return false;
      }
      this.logger.error('[verifyPassword]', err?.response?.data);
      throw new InternalServerErrorException(
        this.i18n.t('auth.KEYCLOAK_AUTH_ERROR'),
      );
    }
  }

  // ─────────────────────────────────────────────────────────────
  // CHANGE PASSWORD — cambia la contraseña de un usuario en Keycloak
  // ─────────────────────────────────────────────────────────────

  async changePassword(keycloakId: string, newPassword: string): Promise<void> {
    const token = await this.getAdminToken();
    try {
      await firstValueFrom(
        this.httpService.put(
          `${this.adminUrl}/users/${keycloakId}/reset-password`,
          { type: 'password', value: newPassword, temporary: false },
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      );
      this.logger.log(
        `Contrasena cambiada para usuario Keycloak: ${keycloakId}`,
      );
    } catch (error: unknown) {
      const err = error as KeycloakAdminError;
      if (err?.response?.status === 403) {
        this.logger.error(
          '[changePassword] Keycloak 403 Forbidden — Verificar permisos realm-admin.',
          err?.response?.data,
        );
      } else {
        this.logger.error('[changePassword]', err?.response?.data);
      }
      throw new InternalServerErrorException(
        this.i18n.t('auth.PASSWORD_CHANGE_ERROR'),
      );
    }
  }

  // ─────────────────────────────────────────────────────────────
  // GET USER SESSIONS — obtiene las sesiones activas de un usuario
  // ─────────────────────────────────────────────────────────────

  async getUserSessions(keycloakId: string): Promise<KeycloakUserSession[]> {
    const token = await this.getAdminToken();
    try {
      const response = await firstValueFrom(
        this.httpService.get<KeycloakUserSession[]>(
          `${this.adminUrl}/users/${keycloakId}/sessions`,
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      );
      return response.data;
    } catch (error: unknown) {
      const err = error as KeycloakAdminError;
      this.logger.error('[getUserSessions]', err?.response?.data);
      throw new InternalServerErrorException(
        this.i18n.t('auth.SESSIONS_ERROR'),
      );
    }
  }

  // ─────────────────────────────────────────────────────────────
  // REVOKE SESSION — cierra una sesión específica
  // ─────────────────────────────────────────────────────────────

  async revokeSession(sessionId: string): Promise<void> {
    const token = await this.getAdminToken();
    try {
      await firstValueFrom(
        this.httpService.delete(`${this.adminUrl}/sessions/${sessionId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
      this.logger.log(`Sesion revocada: ${sessionId}`);
    } catch (error: unknown) {
      const err = error as KeycloakAdminError;
      this.logger.error('[revokeSession]', err?.response?.data);
      throw new InternalServerErrorException(
        this.i18n.t('auth.SESSION_REVOKE_ERROR'),
      );
    }
  }

  // ─────────────────────────────────────────────────────────────
  // GET USER EVENTS — obtiene eventos de auditoría de Keycloak
  // ─────────────────────────────────────────────────────────────

  async getUserEvents(
    keycloakId: string,
    max = 50,
  ): Promise<KeycloakUserEvent[]> {
    const token = await this.getAdminToken();
    try {
      const response = await firstValueFrom(
        this.httpService.get<KeycloakUserEvent[]>(`${this.adminUrl}/events`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { user: keycloakId, max },
        }),
      );
      return response.data;
    } catch (error: unknown) {
      const err = error as KeycloakAdminError;
      this.logger.error('[getUserEvents]', err?.response?.data);
      throw new InternalServerErrorException(this.i18n.t('auth.EVENTS_ERROR'));
    }
  }

  async getRealmRole(roleName: string): Promise<{ id: string; name: string }> {
    const token = await this.getAdminToken();
    try {
      const response = await firstValueFrom(
        this.httpService.get<{ id: string; name: string }>(
          `${this.adminUrl}/roles/${encodeURIComponent(roleName)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      );
      return response.data;
    } catch (error: unknown) {
      const err = error as KeycloakAdminError;
      if (err?.response?.status === 404) {
        throw new NotFoundException(
          this.i18n.t('auth.ROLE_NOT_FOUND') ??
            `Rol no encontrado: ${roleName}`,
        );
      }
      this.logger.error('[getRealmRole]', err?.response?.data);
      throw new InternalServerErrorException(
        this.i18n.t('auth.ROLE_FETCH_ERROR') ?? 'Error al obtener rol',
      );
    }
  }

  async getUserRealmRoles(keycloakId: string): Promise<string[]> {
    const token = await this.getAdminToken();
    try {
      const response = await firstValueFrom(
        this.httpService.get<{ name: string }[]>(
          `${this.adminUrl}/users/${keycloakId}/role-mappings/realm`,
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      );
      return (response.data ?? []).map((r) => r.name).filter(Boolean);
    } catch (error: unknown) {
      const err = error as KeycloakAdminError;
      this.logger.error('[getUserRealmRoles]', err?.response?.data);
      throw new InternalServerErrorException(
        this.i18n.t('auth.ROLE_FETCH_ERROR') ?? 'Error al obtener roles',
      );
    }
  }

  async assignRealmRoles(
    keycloakId: string,
    roleNames: string[],
  ): Promise<void> {
    if (!roleNames.length) return;
    const token = await this.getAdminToken();
    const roles = await Promise.all(
      roleNames.map((name) => this.getRealmRole(name)),
    );
    try {
      await firstValueFrom(
        this.httpService.post(
          `${this.adminUrl}/users/${keycloakId}/role-mappings/realm`,
          roles,
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      );
      this.logger.log(
        `Roles asignados a ${keycloakId}: ${roleNames.join(', ')}`,
      );
    } catch (error: unknown) {
      const err = error as KeycloakAdminError;
      this.logger.error('[assignRealmRoles]', err?.response?.data);
      throw new InternalServerErrorException(
        this.i18n.t('auth.ROLE_ASSIGN_ERROR') ?? 'Error al asignar roles',
      );
    }
  }

  async removeRealmRoles(
    keycloakId: string,
    roleNames: string[],
  ): Promise<void> {
    if (!roleNames.length) return;
    const token = await this.getAdminToken();
    const roles = await Promise.all(
      roleNames.map((name) => this.getRealmRole(name)),
    );
    try {
      await firstValueFrom(
        this.httpService.delete(
          `${this.adminUrl}/users/${keycloakId}/role-mappings/realm`,
          {
            headers: { Authorization: `Bearer ${token}` },
            data: roles,
          },
        ),
      );
      this.logger.log(
        `Roles removidos de ${keycloakId}: ${roleNames.join(', ')}`,
      );
    } catch (error: unknown) {
      const err = error as KeycloakAdminError;
      this.logger.error('[removeRealmRoles]', err?.response?.data);
      throw new InternalServerErrorException(
        this.i18n.t('auth.ROLE_REMOVE_ERROR') ?? 'Error al remover roles',
      );
    }
  }

  async setUserEnabled(keycloakId: string, enabled: boolean): Promise<void> {
    const token = await this.getAdminToken();
    try {
      await firstValueFrom(
        this.httpService.put(
          `${this.adminUrl}/users/${keycloakId}`,
          { enabled },
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      );
      this.logger.log(`Usuario Keycloak ${keycloakId} enabled=${enabled}`);
    } catch (error: unknown) {
      const err = error as KeycloakAdminError;
      this.logger.error('[setUserEnabled]', err?.response?.data);
      throw new InternalServerErrorException(
        this.i18n.t('auth.USER_UPDATE_ERROR'),
      );
    }
  }

  async revokeAllSessions(keycloakId: string): Promise<void> {
    const token = await this.getAdminToken();
    try {
      await firstValueFrom(
        this.httpService.post(
          `${this.adminUrl}/users/${keycloakId}/logout`,
          {},
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      );
      this.logger.log(`Todas las sesiones revocadas: ${keycloakId}`);
    } catch (error: unknown) {
      const err = error as KeycloakAdminError;
      this.logger.error('[revokeAllSessions]', err?.response?.data);
      throw new InternalServerErrorException(
        this.i18n.t('auth.SESSION_REVOKE_ERROR'),
      );
    }
  }
}

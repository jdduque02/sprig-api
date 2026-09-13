import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  ConflictException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';
import { KeycloakAdminService } from '@auth/service/keycloak-admin.service';
import { I18nService } from 'nestjs-i18n';

interface KeycloakAdminServiceUnderTest {
  getAdminToken(): Promise<string>;
}

const mockHttpService = {
  post: jest.fn(),
  get: jest.fn(),
  delete: jest.fn(),
  put: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    const config: Record<string, string> = {
      KEYCLOAK_URL: 'http://localhost:8080',
      KEYCLOAK_REALM: 'master',
      KEYCLOAK_CLIENT_ID: 'my-nestjs-app',
      KEYCLOAK_SECRET: 'test-secret',
    };
    return config[key];
  }),
};

const mockCacheManager = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

const mockI18nService = {
  t: jest.fn((key: string) => `[${key}]`),
};

const axiosResponse = <T>(
  data: T,
  headers: Record<string, string> = {},
): AxiosResponse<T> => ({
  data,
  status: 200,
  statusText: 'OK',
  headers,
  config: { headers: {} } as unknown as AxiosResponse<T>['config'],
});

const ADMIN_TOKEN = 'admin-jwt-token';

describe('KeycloakAdminService', () => {
  let service: KeycloakAdminService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KeycloakAdminService,
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
        { provide: I18nService, useValue: mockI18nService },
      ],
    }).compile();

    service = module.get<KeycloakAdminService>(KeycloakAdminService);
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // GET ADMIN TOKEN
  // ─────────────────────────────────────────────────────────────
  describe('getAdminToken', () => {
    it('debe retornar el access_token de administración', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockCacheManager.set.mockResolvedValue(undefined);
      mockHttpService.post.mockReturnValue(
        of(axiosResponse({ access_token: ADMIN_TOKEN, expires_in: 300 })),
      );
      const token = await (
        service as unknown as KeycloakAdminServiceUnderTest
      ).getAdminToken();
      expect(token).toBe(ADMIN_TOKEN);
    });

    it('debe lanzar InternalServerErrorException si Keycloak falla', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockHttpService.post.mockReturnValue(
        throwError(() => ({
          response: { status: 500, data: {} },
          message: 'Network error',
        })),
      );
      await expect(
        (service as unknown as KeycloakAdminServiceUnderTest).getAdminToken(),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('debe retornar el token desde caché si existe', async () => {
      mockCacheManager.get.mockResolvedValue(ADMIN_TOKEN);
      const token = await (
        service as unknown as KeycloakAdminServiceUnderTest
      ).getAdminToken();
      expect(token).toBe(ADMIN_TOKEN);
      expect(mockHttpService.post).not.toHaveBeenCalled();
    });

    it('debe usar TTL por defecto si Keycloak no devuelve expires_in', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockCacheManager.set.mockResolvedValue(undefined);
      mockHttpService.post.mockReturnValue(
        of(axiosResponse({ access_token: ADMIN_TOKEN })),
      );
      const token = await (
        service as unknown as KeycloakAdminServiceUnderTest
      ).getAdminToken();
      expect(token).toBe(ADMIN_TOKEN);
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'keycloak:admin_token',
        ADMIN_TOKEN,
        50000,
      );
    });

    it('debe lanzar InternalServerErrorException si el mensaje de error no es string', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockHttpService.post.mockReturnValue(
        throwError(() => ({
          response: { status: 500, data: {} },
          message: { detail: 'boom' },
        })),
      );
      await expect(
        (service as unknown as KeycloakAdminServiceUnderTest).getAdminToken(),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('debe loguear UNDEFINED si no hay client secret configurado', async () => {
      const localConfig = {
        get: jest.fn((key: string) => {
          const config: Record<string, string | undefined> = {
            KEYCLOAK_URL: 'http://localhost:8080',
            KEYCLOAK_REALM: 'master',
            KEYCLOAK_CLIENT_ID: 'my-nestjs-app',
          };
          return config[key];
        }),
      };
      const loggerSpy = jest
        .spyOn(Logger.prototype, 'debug')
        .mockImplementation(() => undefined);
      const localModule = await Test.createTestingModule({
        providers: [
          KeycloakAdminService,
          { provide: HttpService, useValue: mockHttpService },
          { provide: ConfigService, useValue: localConfig },
          { provide: CACHE_MANAGER, useValue: mockCacheManager },
          { provide: I18nService, useValue: mockI18nService },
        ],
      }).compile();
      const localService =
        localModule.get<KeycloakAdminService>(KeycloakAdminService);
      mockCacheManager.get.mockResolvedValue(null);
      mockCacheManager.set.mockResolvedValue(undefined);
      mockHttpService.post.mockReturnValue(
        of(axiosResponse({ access_token: ADMIN_TOKEN, expires_in: 300 })),
      );
      await (
        localService as unknown as KeycloakAdminServiceUnderTest
      ).getAdminToken();
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('my-nestjs-app'),
      );
      loggerSpy.mockRestore();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // CREATE USER
  // ─────────────────────────────────────────────────────────────
  describe('createUser', () => {
    const dto = {
      username: 'newuser',
      email: 'new@test.com',
      password: 'pass123',
    };
    const locationHeader = {
      location: 'http://keycloak/realms/master/users/new-kc-id',
    };

    beforeEach(() => {
      // getAdminToken siempre exitoso
      mockCacheManager.get.mockResolvedValue(null);
      mockCacheManager.set.mockResolvedValue(undefined);
      mockHttpService.post.mockReturnValueOnce(
        of(axiosResponse({ access_token: ADMIN_TOKEN, expires_in: 300 })),
      );
    });

    it('debe crear el usuario y retornar su keycloakId', async () => {
      mockHttpService.post.mockReturnValueOnce(
        of(axiosResponse({}, locationHeader)),
      );
      const result = await service.createUser(dto);
      expect(result).toBe('new-kc-id');
    });

    it('debe lanzar ConflictException si el usuario ya existe (409)', async () => {
      mockHttpService.post.mockReturnValueOnce(
        throwError(() => ({ response: { status: 409, data: {} } })),
      );
      await expect(service.createUser(dto)).rejects.toThrow(ConflictException);
    });

    it('debe lanzar InternalServerErrorException en error de red', async () => {
      mockHttpService.post.mockReturnValueOnce(
        throwError(() => ({ response: { status: 500, data: {} } })),
      );
      await expect(service.createUser(dto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('debe lanzar InternalServerErrorException si Keycloak devuelve 403', async () => {
      mockHttpService.post.mockReturnValueOnce(
        throwError(() => ({ response: { status: 403, data: {} } })),
      );
      await expect(service.createUser(dto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // DELETE USER (rollback)
  // ─────────────────────────────────────────────────────────────
  describe('deleteUser', () => {
    beforeEach(() => {
      mockCacheManager.get.mockResolvedValue(ADMIN_TOKEN);
    });

    it('debe eliminar el usuario de Keycloak sin lanzar excepción', async () => {
      mockHttpService.delete.mockReturnValue(of(axiosResponse({})));
      await expect(service.deleteUser('kc-id-123')).resolves.toBeUndefined();
      expect(mockHttpService.delete).toHaveBeenCalledTimes(1);
    });

    it('debe silenciar el error si la eliminación falla (rollback best-effort)', async () => {
      mockHttpService.delete.mockReturnValue(
        throwError(() => ({ response: { status: 500, data: {} } })),
      );
      // No debe lanzar excepción — es best-effort
      await expect(service.deleteUser('kc-id-123')).resolves.toBeUndefined();
    });

    it('debe silenciar el error 403 de Keycloak (rollback best-effort)', async () => {
      mockHttpService.delete.mockReturnValue(
        throwError(() => ({ response: { status: 403, data: {} } })),
      );
      await expect(service.deleteUser('kc-id-123')).resolves.toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // FIND KEYCLOAK ID BY EMAIL
  // ─────────────────────────────────────────────────────────────
  describe('findKeycloakIdByEmail', () => {
    beforeEach(() => {
      mockCacheManager.get.mockResolvedValue(ADMIN_TOKEN);
    });

    it('debe retornar el keycloakId del usuario encontrado', async () => {
      mockHttpService.get.mockReturnValue(
        of(axiosResponse([{ id: 'found-kc-id', username: 'testuser' }])),
      );
      const result = await service.findKeycloakIdByEmail('test@test.com');
      expect(result).toBe('found-kc-id');
    });

    it('debe lanzar NotFoundException si no existe usuario con ese email', async () => {
      mockHttpService.get.mockReturnValue(of(axiosResponse([])));
      await expect(
        service.findKeycloakIdByEmail('noexiste@test.com'),
      ).rejects.toThrow(NotFoundException);
    });

    it('debe lanzar InternalServerErrorException en error de red', async () => {
      mockHttpService.get.mockReturnValue(
        throwError(() => ({ response: { status: 500, data: {} } })),
      );
      await expect(
        service.findKeycloakIdByEmail('test@test.com'),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('debe lanzar InternalServerErrorException si Keycloak devuelve 403', async () => {
      mockHttpService.get.mockReturnValue(
        throwError(() => ({ response: { status: 403, data: {} } })),
      );
      await expect(
        service.findKeycloakIdByEmail('test@test.com'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // SEND RESET PASSWORD EMAIL
  // ─────────────────────────────────────────────────────────────
  describe('sendResetPasswordEmail', () => {
    beforeEach(() => {
      mockCacheManager.get.mockResolvedValue(ADMIN_TOKEN);
    });

    it('debe enviar el email de reset sin lanzar excepción', async () => {
      mockHttpService.put.mockReturnValue(of(axiosResponse({})));
      await expect(
        service.sendResetPasswordEmail('kc-id-123'),
      ).resolves.toBeUndefined();
      expect(mockHttpService.put).toHaveBeenCalledTimes(1);
    });

    it('debe lanzar InternalServerErrorException si Keycloak falla', async () => {
      mockHttpService.put.mockReturnValue(
        throwError(() => ({ response: { status: 500, data: {} } })),
      );
      await expect(service.sendResetPasswordEmail('kc-id-123')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('debe lanzar InternalServerErrorException si Keycloak devuelve 403', async () => {
      mockHttpService.put.mockReturnValue(
        throwError(() => ({ response: { status: 403, data: {} } })),
      );
      await expect(service.sendResetPasswordEmail('kc-id-123')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // UPDATE USER
  // ─────────────────────────────────────────────────────────────
  describe('updateUser', () => {
    beforeEach(() => {
      mockCacheManager.get.mockResolvedValue(ADMIN_TOKEN);
    });

    it('debe actualizar el usuario en Keycloak sin lanzar excepción', async () => {
      mockHttpService.put.mockReturnValue(of(axiosResponse({})));
      await expect(
        service.updateUser('kc-id-123', { email: 'new@test.com' }),
      ).resolves.toBeUndefined();
      expect(mockHttpService.put).toHaveBeenCalledTimes(1);
    });

    it('debe lanzar ConflictException si el usuario ya existe (409)', async () => {
      mockHttpService.put.mockReturnValue(
        throwError(() => ({ response: { status: 409, data: {} } })),
      );
      await expect(
        service.updateUser('kc-id-123', { email: 'new@test.com' }),
      ).rejects.toThrow(ConflictException);
    });

    it('debe lanzar InternalServerErrorException si Keycloak devuelve 403', async () => {
      mockHttpService.put.mockReturnValue(
        throwError(() => ({ response: { status: 403, data: {} } })),
      );
      await expect(
        service.updateUser('kc-id-123', { email: 'new@test.com' }),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('debe lanzar InternalServerErrorException en error de red', async () => {
      mockHttpService.put.mockReturnValue(
        throwError(() => ({ response: { status: 500, data: {} } })),
      );
      await expect(
        service.updateUser('kc-id-123', { email: 'new@test.com' }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // VERIFY PASSWORD
  // ─────────────────────────────────────────────────────────────
  describe('verifyPassword', () => {
    it('debe retornar true si las credenciales son válidas', async () => {
      mockHttpService.post.mockReturnValue(
        of(axiosResponse({ access_token: 'user-token' })),
      );
      await expect(service.verifyPassword('user', 'pass')).resolves.toBe(true);
    });

    it('debe retornar false si Keycloak responde 401', async () => {
      mockHttpService.post.mockReturnValue(
        throwError(() => ({ response: { status: 401, data: {} } })),
      );
      await expect(service.verifyPassword('user', 'wrong')).resolves.toBe(
        false,
      );
    });

    it('debe retornar false si Keycloak responde 400', async () => {
      mockHttpService.post.mockReturnValue(
        throwError(() => ({ response: { status: 400, data: {} } })),
      );
      await expect(service.verifyPassword('user', 'wrong')).resolves.toBe(
        false,
      );
    });

    it('debe lanzar InternalServerErrorException en error de red', async () => {
      mockHttpService.post.mockReturnValue(
        throwError(() => ({ response: { status: 500, data: {} } })),
      );
      await expect(service.verifyPassword('user', 'pass')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // CHANGE PASSWORD
  // ─────────────────────────────────────────────────────────────
  describe('changePassword', () => {
    beforeEach(() => {
      mockCacheManager.get.mockResolvedValue(ADMIN_TOKEN);
    });

    it('debe cambiar la contraseña sin lanzar excepción', async () => {
      mockHttpService.put.mockReturnValue(of(axiosResponse({})));
      await expect(
        service.changePassword('kc-id-123', 'NewPass123!'),
      ).resolves.toBeUndefined();
      expect(mockHttpService.put).toHaveBeenCalledTimes(1);
    });

    it('debe lanzar InternalServerErrorException si Keycloak devuelve 403', async () => {
      mockHttpService.put.mockReturnValue(
        throwError(() => ({ response: { status: 403, data: {} } })),
      );
      await expect(
        service.changePassword('kc-id-123', 'NewPass123!'),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('debe lanzar InternalServerErrorException en error de red', async () => {
      mockHttpService.put.mockReturnValue(
        throwError(() => ({ response: { status: 500, data: {} } })),
      );
      await expect(
        service.changePassword('kc-id-123', 'NewPass123!'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET USER SESSIONS
  // ─────────────────────────────────────────────────────────────
  describe('getUserSessions', () => {
    beforeEach(() => {
      mockCacheManager.get.mockResolvedValue(ADMIN_TOKEN);
    });

    it('debe retornar las sesiones activas del usuario', async () => {
      const sessions = [{ id: 's1', ipAddress: '1.2.3.4', start: 1000 }];
      mockHttpService.get.mockReturnValue(of(axiosResponse(sessions)));
      const result = await service.getUserSessions('kc-id-123');
      expect(result).toEqual(sessions);
    });

    it('debe lanzar InternalServerErrorException si Keycloak falla', async () => {
      mockHttpService.get.mockReturnValue(
        throwError(() => ({ response: { status: 500, data: {} } })),
      );
      await expect(service.getUserSessions('kc-id-123')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // REVOKE SESSION
  // ─────────────────────────────────────────────────────────────
  describe('revokeSession', () => {
    beforeEach(() => {
      mockCacheManager.get.mockResolvedValue(ADMIN_TOKEN);
    });

    it('debe revocar la sesión sin lanzar excepción', async () => {
      mockHttpService.delete.mockReturnValue(of(axiosResponse({})));
      await expect(service.revokeSession('session-1')).resolves.toBeUndefined();
      expect(mockHttpService.delete).toHaveBeenCalledTimes(1);
    });

    it('debe lanzar InternalServerErrorException si Keycloak falla', async () => {
      mockHttpService.delete.mockReturnValue(
        throwError(() => ({ response: { status: 500, data: {} } })),
      );
      await expect(service.revokeSession('session-1')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET USER EVENTS
  // ─────────────────────────────────────────────────────────────
  describe('getUserEvents', () => {
    beforeEach(() => {
      mockCacheManager.get.mockResolvedValue(ADMIN_TOKEN);
    });

    it('debe retornar los eventos con max explícito', async () => {
      const events = [{ type: 'LOGIN', ipAddress: '1.2.3.4', time: 1000 }];
      mockHttpService.get.mockReturnValue(of(axiosResponse(events)));
      const result = await service.getUserEvents('kc-id-123', 100);
      expect(result).toEqual(events);
    });

    it('debe usar max=50 por defecto', async () => {
      mockHttpService.get.mockReturnValue(of(axiosResponse([])));
      await service.getUserEvents('kc-id-123');
      expect(mockHttpService.get).toHaveBeenCalledWith(
        expect.stringContaining('/events'),
        expect.objectContaining({
          params: { user: 'kc-id-123', max: 50 },
        }),
      );
    });

    it('debe lanzar InternalServerErrorException si Keycloak falla', async () => {
      mockHttpService.get.mockReturnValue(
        throwError(() => ({ response: { status: 500, data: {} } })),
      );
      await expect(service.getUserEvents('kc-id-123')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET REALM ROLE
  // ─────────────────────────────────────────────────────────────
  describe('getRealmRole', () => {
    beforeEach(() => {
      mockCacheManager.get.mockResolvedValue(ADMIN_TOKEN);
    });

    it('debe retornar el rol solicitado', async () => {
      const role = { id: 'role-1', name: 'admin' };
      mockHttpService.get.mockReturnValue(of(axiosResponse(role)));
      const result = await service.getRealmRole('admin');
      expect(result).toEqual(role);
    });

    it('debe lanzar NotFoundException si el rol no existe (404)', async () => {
      mockHttpService.get.mockReturnValue(
        throwError(() => ({ response: { status: 404, data: {} } })),
      );
      await expect(service.getRealmRole('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('debe usar el mensaje por defecto si i18n no tiene traducción', async () => {
      mockHttpService.get.mockReturnValue(
        throwError(() => ({ response: { status: 404, data: {} } })),
      );
      mockI18nService.t.mockReturnValueOnce(undefined);
      await expect(service.getRealmRole('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('debe lanzar InternalServerErrorException en error de red', async () => {
      mockHttpService.get.mockReturnValue(
        throwError(() => ({ response: { status: 500, data: {} } })),
      );
      await expect(service.getRealmRole('admin')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('debe usar el mensaje por defecto al fallar la obtención del rol', async () => {
      mockHttpService.get.mockReturnValue(
        throwError(() => ({ response: { status: 500, data: {} } })),
      );
      mockI18nService.t.mockReturnValueOnce(undefined);
      await expect(service.getRealmRole('admin')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET USER REALM ROLES
  // ─────────────────────────────────────────────────────────────
  describe('getUserRealmRoles', () => {
    beforeEach(() => {
      mockCacheManager.get.mockResolvedValue(ADMIN_TOKEN);
    });

    it('debe retornar los nombres de los roles del usuario', async () => {
      mockHttpService.get.mockReturnValue(
        of(axiosResponse([{ name: 'user' }, { name: 'admin' }])),
      );
      const result = await service.getUserRealmRoles('kc-id-123');
      expect(result).toEqual(['user', 'admin']);
    });

    it('debe ignorar nombres de roles vacíos', async () => {
      mockHttpService.get.mockReturnValue(
        of(axiosResponse([{ name: 'user' }, { name: '' }])),
      );
      const result = await service.getUserRealmRoles('kc-id-123');
      expect(result).toEqual(['user']);
    });

    it('debe retornar [] si Keycloak devuelve data nula', async () => {
      mockHttpService.get.mockReturnValue(of(axiosResponse(null)));
      const result = await service.getUserRealmRoles('kc-id-123');
      expect(result).toEqual([]);
    });

    it('debe lanzar InternalServerErrorException si Keycloak falla', async () => {
      mockHttpService.get.mockReturnValue(
        throwError(() => ({ response: { status: 500, data: {} } })),
      );
      await expect(service.getUserRealmRoles('kc-id-123')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('debe usar el mensaje por defecto al fallar la obtención de roles', async () => {
      mockHttpService.get.mockReturnValue(
        throwError(() => ({ response: { status: 500, data: {} } })),
      );
      mockI18nService.t.mockReturnValueOnce(undefined);
      await expect(service.getUserRealmRoles('kc-id-123')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // ASSIGN REALM ROLES
  // ─────────────────────────────────────────────────────────────
  describe('assignRealmRoles', () => {
    beforeEach(() => {
      mockCacheManager.get.mockResolvedValue(ADMIN_TOKEN);
    });

    it('debe no hacer nada si la lista de roles está vacía', async () => {
      await service.assignRealmRoles('kc-id-123', []);
      expect(mockHttpService.post).not.toHaveBeenCalled();
      expect(mockHttpService.get).not.toHaveBeenCalled();
    });

    it('debe asignar los roles al usuario', async () => {
      mockHttpService.get.mockReturnValue(
        of(axiosResponse({ id: 'role-1', name: 'user' })),
      );
      mockHttpService.post.mockReturnValue(of(axiosResponse({})));
      await expect(
        service.assignRealmRoles('kc-id-123', ['user']),
      ).resolves.toBeUndefined();
      expect(mockHttpService.post).toHaveBeenCalledWith(
        expect.stringContaining('/users/kc-id-123/role-mappings/realm'),
        [{ id: 'role-1', name: 'user' }],
        expect.any(Object),
      );
    });

    it('debe lanzar InternalServerErrorException si Keycloak falla', async () => {
      mockHttpService.get.mockReturnValue(
        of(axiosResponse({ id: 'role-1', name: 'user' })),
      );
      mockHttpService.post.mockReturnValue(
        throwError(() => ({ response: { status: 500, data: {} } })),
      );
      await expect(
        service.assignRealmRoles('kc-id-123', ['user']),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('debe usar el mensaje por defecto si falla la asignación', async () => {
      mockHttpService.get.mockReturnValue(
        of(axiosResponse({ id: 'role-1', name: 'user' })),
      );
      mockHttpService.post.mockReturnValue(
        throwError(() => ({ response: { status: 500, data: {} } })),
      );
      mockI18nService.t.mockReturnValueOnce(undefined);
      await expect(
        service.assignRealmRoles('kc-id-123', ['user']),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // REMOVE REALM ROLES
  // ─────────────────────────────────────────────────────────────
  describe('removeRealmRoles', () => {
    beforeEach(() => {
      mockCacheManager.get.mockResolvedValue(ADMIN_TOKEN);
    });

    it('debe no hacer nada si la lista de roles está vacía', async () => {
      await service.removeRealmRoles('kc-id-123', []);
      expect(mockHttpService.delete).not.toHaveBeenCalled();
      expect(mockHttpService.get).not.toHaveBeenCalled();
    });

    it('debe remover los roles del usuario', async () => {
      mockHttpService.get.mockReturnValue(
        of(axiosResponse({ id: 'role-1', name: 'admin' })),
      );
      mockHttpService.delete.mockReturnValue(of(axiosResponse({})));
      await expect(
        service.removeRealmRoles('kc-id-123', ['admin']),
      ).resolves.toBeUndefined();
      expect(mockHttpService.delete).toHaveBeenCalledTimes(1);
    });

    it('debe lanzar InternalServerErrorException si Keycloak falla', async () => {
      mockHttpService.get.mockReturnValue(
        of(axiosResponse({ id: 'role-1', name: 'admin' })),
      );
      mockHttpService.delete.mockReturnValue(
        throwError(() => ({ response: { status: 500, data: {} } })),
      );
      await expect(
        service.removeRealmRoles('kc-id-123', ['admin']),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('debe usar el mensaje por defecto si falla la remoción', async () => {
      mockHttpService.get.mockReturnValue(
        of(axiosResponse({ id: 'role-1', name: 'admin' })),
      );
      mockHttpService.delete.mockReturnValue(
        throwError(() => ({ response: { status: 500, data: {} } })),
      );
      mockI18nService.t.mockReturnValueOnce(undefined);
      await expect(
        service.removeRealmRoles('kc-id-123', ['admin']),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // SET USER ENABLED
  // ─────────────────────────────────────────────────────────────
  describe('setUserEnabled', () => {
    beforeEach(() => {
      mockCacheManager.get.mockResolvedValue(ADMIN_TOKEN);
    });

    it('debe habilitar/deshabilitar el usuario sin lanzar excepción', async () => {
      mockHttpService.put.mockReturnValue(of(axiosResponse({})));
      await expect(
        service.setUserEnabled('kc-id-123', false),
      ).resolves.toBeUndefined();
      expect(mockHttpService.put).toHaveBeenCalledTimes(1);
    });

    it('debe lanzar InternalServerErrorException si Keycloak falla', async () => {
      mockHttpService.put.mockReturnValue(
        throwError(() => ({ response: { status: 500, data: {} } })),
      );
      await expect(service.setUserEnabled('kc-id-123', true)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // REVOKE ALL SESSIONS
  // ─────────────────────────────────────────────────────────────
  describe('revokeAllSessions', () => {
    beforeEach(() => {
      mockCacheManager.get.mockResolvedValue(ADMIN_TOKEN);
    });

    it('debe revocar todas las sesiones sin lanzar excepción', async () => {
      mockHttpService.post.mockReturnValue(of(axiosResponse({})));
      await expect(
        service.revokeAllSessions('kc-id-123'),
      ).resolves.toBeUndefined();
      expect(mockHttpService.post).toHaveBeenCalledWith(
        expect.stringContaining('/users/kc-id-123/logout'),
        {},
        expect.any(Object),
      );
    });

    it('debe lanzar InternalServerErrorException si Keycloak falla', async () => {
      mockHttpService.post.mockReturnValue(
        throwError(() => ({ response: { status: 500, data: {} } })),
      );
      await expect(service.revokeAllSessions('kc-id-123')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});

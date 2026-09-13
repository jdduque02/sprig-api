import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { UserService } from '@identity/service/user.service';
import { UserRepository } from '@identity/repositories/app-user.repositories';
import { KeycloakAdminService } from '@auth/service/keycloak-admin.service';
import { CreateUserDto } from '@identity/dto/user/create-user.dto';
import { UpdateUserDto } from '@identity/dto/user/update-user.dto';
import { UserQueryDto } from '@identity/dto/user/user-query.dto';
import { AppUser } from '@identity/entities/app-user.entity';
import { EncryptionService } from '@shared/services/encryption.service';
import { PresenceService } from '@shared/services/presence.service';
import { AuditLogService } from '@audit/service/audit-log.service';

const mockUserRepository = {
  create: jest.fn(),
  findById: jest.fn(),
  findByExternalId: jest.fn(),
  update: jest.fn(),
  updateRoles: jest.fn(),
  updateActiveStatus: jest.fn(),
  findAll: jest.fn(),
};

const mockKeycloakAdminService = {
  createUser: jest.fn(),
  deleteUser: jest.fn(),
  updateUser: jest.fn(),
  assignRealmRoles: jest.fn(),
  removeRealmRoles: jest.fn(),
  getUserRealmRoles: jest.fn(),
  setUserEnabled: jest.fn(),
  revokeAllSessions: jest.fn(),
  sendResetPasswordEmail: jest.fn(),
  getUserSessions: jest.fn(),
  getUserEvents: jest.fn(),
  revokeSession: jest.fn(),
};

const mockCacheManager = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

const mockEncryptionService = {
  encryptField: jest.fn(),
  decryptField: jest.fn(),
};

const mockI18nService = {
  translate: jest.fn((_key: string) => ''),
  t: jest.fn((key: string) => key),
};

const mockConfigService = {
  get: jest.fn((_key: string, defaultVal?: unknown) => defaultVal),
};

const mockPresenceService = {
  getOnlineMap: jest.fn(() => new Set<string>()),
  isOnline: jest.fn(() => false),
  markOnline: jest.fn(),
  markOffline: jest.fn(),
};

const mockAuditLogService = {
  write: jest.fn(),
};

const buildUser = (overrides: Partial<AppUser> = {}): AppUser =>
  ({
    id: '1',
    external_id: 'kc-uuid',
    username: 'testuser',
    email: 'test@test.com',
    locale: 'es-CO',
    timezone: 'America/Bogota',
    metadata: {},
    roles: ['user'],
    last_login_at: null,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  }) as AppUser;

describe('UserService', () => {
  let service: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: UserRepository, useValue: mockUserRepository },
        { provide: KeycloakAdminService, useValue: mockKeycloakAdminService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
        { provide: I18nService, useValue: mockI18nService },
        { provide: EncryptionService, useValue: mockEncryptionService },
        { provide: PresenceService, useValue: mockPresenceService },
        { provide: AuditLogService, useValue: mockAuditLogService },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    jest.clearAllMocks();
    mockKeycloakAdminService.assignRealmRoles.mockResolvedValue(undefined);
  });

  // ─────────────────────────────────────────────────────────────
  // CREATE USER
  // ─────────────────────────────────────────────────────────────
  describe('createUser', () => {
    const dto: CreateUserDto = {
      username: 'newuser',
      email: 'new@test.com',
      password: 'secret123',
    };

    it('debe crear el usuario en Keycloak y en BD', async () => {
      const user = buildUser({ username: 'newuser', email: 'new@test.com' });
      mockKeycloakAdminService.createUser.mockResolvedValue('kc-new-uuid');
      mockUserRepository.create.mockResolvedValue(user);

      const result = await service.createUser(dto);
      expect(mockKeycloakAdminService.createUser).toHaveBeenCalledTimes(1);
      expect(mockUserRepository.create).toHaveBeenCalledTimes(1);
      expect(result.username).toBe('newuser');
    });

    it('debe hacer rollback en Keycloak si falla la BD', async () => {
      mockKeycloakAdminService.createUser.mockResolvedValue('kc-new-uuid');
      mockUserRepository.create.mockRejectedValue(new Error('DB error'));
      mockKeycloakAdminService.deleteUser.mockResolvedValue(undefined);

      await expect(service.createUser(dto)).rejects.toThrow('DB error');
      expect(mockKeycloakAdminService.deleteUser).toHaveBeenCalledWith(
        'kc-new-uuid',
      );
    });

    it('debe hacer rollback aunque el error no sea una instancia de Error', async () => {
      mockKeycloakAdminService.createUser.mockResolvedValue('kc-new-uuid');
      mockUserRepository.create.mockRejectedValue('string-error');
      mockKeycloakAdminService.deleteUser.mockResolvedValue(undefined);

      await expect(service.createUser(dto)).rejects.toBe('string-error');
      expect(mockKeycloakAdminService.deleteUser).toHaveBeenCalledWith(
        'kc-new-uuid',
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // FIND USER
  // ─────────────────────────────────────────────────────────────
  describe('findUser', () => {
    it('debe retornar usuario desde caché si existe', async () => {
      const cached = buildUser();
      mockCacheManager.get.mockResolvedValue(cached);

      const result = await service.findUser('1');
      expect(result).toEqual(cached);
      expect(mockUserRepository.findById).not.toHaveBeenCalled();
    });

    it('debe consultar BD y guardar en caché si no está cacheado', async () => {
      const user = buildUser();
      mockCacheManager.get.mockResolvedValue(null);
      mockUserRepository.findById.mockResolvedValue(user);

      const result = await service.findUser('1');
      expect(mockUserRepository.findById).toHaveBeenCalledWith('1');
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'user_1',
        expect.objectContaining({ id: '1', username: 'testuser' }),
        60000,
      );
      expect(result).toEqual(
        expect.objectContaining({ id: '1', username: 'testuser' }),
      );
    });

    it('debe retornar null si el usuario no existe en BD ni caché', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockUserRepository.findById.mockResolvedValue(null);

      const result = await service.findUser('99');
      expect(result).toBeNull();
      expect(mockCacheManager.set).not.toHaveBeenCalled();
    });

    it('debe manejar roles nulos y last_login_at presente al construir el DTO', async () => {
      const lastLogin = new Date('2024-01-01T00:00:00.000Z');
      const user = buildUser({
        roles: null as unknown as string[],
        last_login_at: lastLogin,
      });
      mockCacheManager.get.mockResolvedValue(null);
      mockUserRepository.findById.mockResolvedValue(user);

      const result = await service.findUser('1');
      expect(result.roles).toEqual([]);
      expect(result.last_login_at).toEqual(lastLogin);
    });

    it('debe desencriptar monthly_income al construir el DTO', async () => {
      const user = buildUser({
        financial_profile: { monthly_income: 'enc-monto' } as never,
      });
      mockCacheManager.get.mockResolvedValue(null);
      mockUserRepository.findById.mockResolvedValue(user);
      mockEncryptionService.decryptField.mockReturnValueOnce('3500000');

      const result = await service.findUser('1');
      expect(mockEncryptionService.decryptField).toHaveBeenCalledWith(
        'enc-monto',
        'finance',
      );
      expect(
        (result.financial_profile as unknown as { monthly_income: number })
          .monthly_income,
      ).toBe(3500000);
    });

    it('debe dejar monthly_income en null si no se puede desencriptar', async () => {
      const user = buildUser({
        financial_profile: { monthly_income: 'enc-monto' } as never,
      });
      mockCacheManager.get.mockResolvedValue(null);
      mockUserRepository.findById.mockResolvedValue(user);
      mockEncryptionService.decryptField.mockReturnValueOnce(null);

      const result = await service.findUser('1');
      expect(
        (
          result.financial_profile as unknown as {
            monthly_income: number | null;
          }
        ).monthly_income,
      ).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // UPDATE USER
  // ─────────────────────────────────────────────────────────────
  describe('updateUser', () => {
    it('debe actualizar usuario e invalidar caché', async () => {
      const dto: UpdateUserDto = { username: 'updated' };
      const updated = buildUser({ username: 'updated' });
      mockUserRepository.update.mockResolvedValue(updated);

      const result = await service.updateUser('1', dto);
      expect(mockUserRepository.update).toHaveBeenCalledWith('1', dto);
      expect(mockCacheManager.del).toHaveBeenCalledWith('user_1');
      expect(result.username).toBe('updated');
    });

    it('debe actualizar el email en Keycloak si cambió', async () => {
      const dto: UpdateUserDto = { email: 'nuevo@test.com' };
      mockUserRepository.findById.mockResolvedValue(
        buildUser({ email: 'test@test.com' }),
      );
      mockUserRepository.update.mockResolvedValue(
        buildUser({ email: 'nuevo@test.com' }),
      );

      const result = await service.updateUser('1', dto);
      expect(mockKeycloakAdminService.updateUser).toHaveBeenCalledWith(
        'kc-uuid',
        { email: 'nuevo@test.com' },
      );
      expect(result.email).toBe('nuevo@test.com');
    });

    it('debe no llamar a Keycloak si el email no cambió', async () => {
      const dto: UpdateUserDto = { email: 'test@test.com' };
      mockUserRepository.findById.mockResolvedValue(
        buildUser({ email: 'test@test.com' }),
      );
      mockUserRepository.update.mockResolvedValue(buildUser());

      await service.updateUser('1', dto);
      expect(mockKeycloakAdminService.updateUser).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // FIND ALL
  // ─────────────────────────────────────────────────────────────
  describe('findAllUsers', () => {
    it('debe delegar al repositorio con el query dto', async () => {
      const query: UserQueryDto = { page: 1, limit: 10 };
      const users = [buildUser()];
      mockUserRepository.findAll.mockResolvedValue({ data: users, total: 1 });

      const result = await service.findAllUsers(query);
      expect(mockUserRepository.findAll).toHaveBeenCalledWith(query);
      expect(result.total).toBe(1);
    });

    it('debe marcar is_online según el mapa de presencia y manejar roles nulos', async () => {
      const query: UserQueryDto = { page: 1, limit: 10 };
      const users = [
        buildUser({
          roles: null as unknown as string[],
          last_login_at: new Date('2024-06-01T00:00:00Z'),
        }),
      ];
      mockUserRepository.findAll.mockResolvedValue({ data: users, total: 1 });
      mockPresenceService.getOnlineMap.mockReturnValueOnce(new Set(['1']));

      const result = await service.findAllUsers(query);
      expect(result.data[0].is_online).toBe(true);
      expect(result.data[0].roles).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // FIND ADMIN USER DETAIL
  // ─────────────────────────────────────────────────────────────
  describe('findAdminUserDetail', () => {
    it('debe retornar detalle con sesiones y eventos de Keycloak', async () => {
      const user = buildUser();
      mockUserRepository.findById.mockResolvedValue(user);
      mockKeycloakAdminService.getUserSessions.mockResolvedValue([
        { id: 's1', ipAddress: '1.2.3.4', start: 100 },
      ]);
      mockKeycloakAdminService.getUserEvents.mockResolvedValue([
        { type: 'LOGIN', ipAddress: '1.2.3.4', time: 100 },
      ]);

      const result = await service.findAdminUserDetail('1');
      expect(result.user.id).toBe('1');
      expect(result.sessions).toHaveLength(1);
      expect(result.accessHistory).toHaveLength(1);
    });

    it('debe retornar arrays vacíos si los servicios de Keycloak fallan', async () => {
      const user = buildUser();
      mockUserRepository.findById.mockResolvedValue(user);
      mockKeycloakAdminService.getUserSessions.mockRejectedValue(
        new Error('kc down'),
      );
      mockKeycloakAdminService.getUserEvents.mockRejectedValue(
        new Error('kc down'),
      );

      const result = await service.findAdminUserDetail('1');
      expect(result.sessions).toEqual([]);
      expect(result.accessHistory).toEqual([]);
    });

    it('debe omitir consultas a Keycloak si el usuario no tiene external_id', async () => {
      const user = buildUser({ external_id: null as unknown as string });
      mockUserRepository.findById.mockResolvedValue(user);

      const result = await service.findAdminUserDetail('1');
      expect(mockKeycloakAdminService.getUserSessions).not.toHaveBeenCalled();
      expect(mockKeycloakAdminService.getUserEvents).not.toHaveBeenCalled();
      expect(result.sessions).toEqual([]);
      expect(result.accessHistory).toEqual([]);
    });

    it('debe desencriptar monthly_income en el DTO de admin', async () => {
      const user = buildUser({
        roles: null as unknown as string[],
        last_login_at: new Date('2024-06-01T00:00:00Z'),
        financial_profile: { monthly_income: 'enc-monto' } as never,
      });
      mockUserRepository.findById.mockResolvedValue(user);
      mockKeycloakAdminService.getUserSessions.mockResolvedValue([]);
      mockKeycloakAdminService.getUserEvents.mockResolvedValue([]);
      mockEncryptionService.decryptField.mockReturnValueOnce('1500000');

      const result = await service.findAdminUserDetail('1');
      expect(mockEncryptionService.decryptField).toHaveBeenCalledWith(
        'enc-monto',
        'finance',
      );
      expect(result.user.financial_profile.monthly_income).toBe(1500000);
      expect(result.user.roles).toEqual([]);
    });

    it('debe dejar monthly_income en null si no se puede desencriptar (admin)', async () => {
      const user = buildUser({
        financial_profile: { monthly_income: 'enc-monto' } as never,
      });
      mockUserRepository.findById.mockResolvedValue(user);
      mockKeycloakAdminService.getUserSessions.mockResolvedValue([]);
      mockKeycloakAdminService.getUserEvents.mockResolvedValue([]);
      mockEncryptionService.decryptField.mockReturnValueOnce('');

      const result = await service.findAdminUserDetail('1');
      expect(result.user.financial_profile.monthly_income).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // UPDATE USER STATUS
  // ─────────────────────────────────────────────────────────────
  describe('updateUserStatus', () => {
    const adminUserId = 42;

    it('debe desactivar en Keycloak y revocar sesiones si se desactiva', async () => {
      mockUserRepository.findById.mockResolvedValue(buildUser());
      mockKeycloakAdminService.setUserEnabled.mockResolvedValue(undefined);
      mockKeycloakAdminService.revokeAllSessions.mockResolvedValue(undefined);
      mockUserRepository.updateActiveStatus.mockResolvedValue(
        buildUser({ is_active: false }),
      );

      const result = await service.updateUserStatus('1', false, adminUserId);
      expect(mockKeycloakAdminService.setUserEnabled).toHaveBeenCalledWith(
        'kc-uuid',
        false,
      );
      expect(mockKeycloakAdminService.revokeAllSessions).toHaveBeenCalledWith(
        'kc-uuid',
      );
      expect(mockUserRepository.updateActiveStatus).toHaveBeenCalledWith(
        '1',
        false,
      );
      expect(mockAuditLogService.write).toHaveBeenCalled();
      expect(result.is_active).toBe(false);
    });

    it('debe no revocar sesiones si se activa', async () => {
      mockUserRepository.findById.mockResolvedValue(buildUser());
      mockKeycloakAdminService.setUserEnabled.mockResolvedValue(undefined);
      mockUserRepository.updateActiveStatus.mockResolvedValue(buildUser());

      await service.updateUserStatus('1', true, adminUserId);
      expect(mockKeycloakAdminService.setUserEnabled).toHaveBeenCalledWith(
        'kc-uuid',
        true,
      );
      expect(mockKeycloakAdminService.revokeAllSessions).not.toHaveBeenCalled();
    });

    it('debe omitir Keycloak si el usuario no tiene external_id', async () => {
      mockUserRepository.findById.mockResolvedValue(
        buildUser({ external_id: null as unknown as string }),
      );
      mockUserRepository.updateActiveStatus.mockResolvedValue(buildUser());

      await service.updateUserStatus('1', true, adminUserId);
      expect(mockKeycloakAdminService.setUserEnabled).not.toHaveBeenCalled();
      expect(mockKeycloakAdminService.revokeAllSessions).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // UPDATE USER ROLES
  // ─────────────────────────────────────────────────────────────
  describe('updateUserRoles', () => {
    const adminUserId = 42;

    it('debe lanzar BadRequestException si el rol no está permitido', async () => {
      await expect(
        service.updateUserRoles('1', ['superadmin'], adminUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe usar el mensaje por defecto si i18n no tiene traducción', async () => {
      mockI18nService.t.mockReturnValueOnce(undefined);
      await expect(
        service.updateUserRoles('1', ['superadmin'], adminUserId),
      ).rejects.toThrow('Rol inválido: superadmin');
    });

    it('debe lanzar BadRequestException si el usuario no tiene external_id', async () => {
      mockUserRepository.findById.mockResolvedValue(
        buildUser({ external_id: null as unknown as string }),
      );
      await expect(
        service.updateUserRoles('1', ['user'], adminUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe agregar rol "user" si no viene en la lista', async () => {
      mockUserRepository.findById.mockResolvedValue(buildUser());
      mockKeycloakAdminService.getUserRealmRoles.mockResolvedValue(['admin']);
      mockKeycloakAdminService.assignRealmRoles.mockResolvedValue(undefined);
      mockUserRepository.updateRoles.mockResolvedValue(buildUser());

      await service.updateUserRoles('1', ['admin'], adminUserId);
      expect(mockUserRepository.updateRoles).toHaveBeenCalledWith('1', [
        'admin',
        'user',
      ]);
      expect(mockKeycloakAdminService.removeRealmRoles).not.toHaveBeenCalled();
      expect(mockKeycloakAdminService.assignRealmRoles).toHaveBeenCalledWith(
        'kc-uuid',
        ['user'],
      );
    });

    it('debe remover y asignar roles según el conjunto objetivo', async () => {
      mockUserRepository.findById.mockResolvedValue(buildUser());
      mockKeycloakAdminService.getUserRealmRoles.mockResolvedValue(['admin']);
      mockKeycloakAdminService.removeRealmRoles.mockResolvedValue(undefined);
      mockKeycloakAdminService.assignRealmRoles.mockResolvedValue(undefined);
      mockUserRepository.updateRoles.mockResolvedValue(buildUser());

      await service.updateUserRoles('1', ['user'], adminUserId);
      expect(mockKeycloakAdminService.removeRealmRoles).toHaveBeenCalledWith(
        'kc-uuid',
        ['admin'],
      );
      expect(mockKeycloakAdminService.assignRealmRoles).toHaveBeenCalledWith(
        'kc-uuid',
        ['user'],
      );
      expect(mockUserRepository.updateRoles).toHaveBeenCalledWith('1', [
        'user',
      ]);
    });

    it('debe no tocar Keycloak si los roles no cambian', async () => {
      mockUserRepository.findById.mockResolvedValue(buildUser());
      mockKeycloakAdminService.getUserRealmRoles.mockResolvedValue(['user']);
      mockUserRepository.updateRoles.mockResolvedValue(buildUser());

      await service.updateUserRoles('1', ['user'], adminUserId);
      expect(mockUserRepository.updateRoles).toHaveBeenCalledWith('1', [
        'user',
      ]);
      expect(mockKeycloakAdminService.removeRealmRoles).not.toHaveBeenCalled();
      expect(mockKeycloakAdminService.assignRealmRoles).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // ADMIN RESET PASSWORD
  // ─────────────────────────────────────────────────────────────
  describe('adminResetPassword', () => {
    it('debe enviar el email de reset y auditar', async () => {
      mockUserRepository.findById.mockResolvedValue(buildUser());
      mockKeycloakAdminService.sendResetPasswordEmail.mockResolvedValue(
        undefined,
      );

      const result = await service.adminResetPassword('1', 7);
      expect(
        mockKeycloakAdminService.sendResetPasswordEmail,
      ).toHaveBeenCalledWith('kc-uuid');
      expect(mockAuditLogService.write).toHaveBeenCalled();
      expect(result).toEqual({ message: 'Email de restablecimiento enviado' });
    });

    it('debe lanzar BadRequestException si el usuario no tiene external_id', async () => {
      mockUserRepository.findById.mockResolvedValue(
        buildUser({ external_id: null as unknown as string }),
      );
      await expect(service.adminResetPassword('1', 7)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // ADMIN REVOKE ALL SESSIONS
  // ─────────────────────────────────────────────────────────────
  describe('adminRevokeAllSessions', () => {
    it('debe revocar todas las sesiones y marcar offline', async () => {
      mockUserRepository.findById.mockResolvedValue(buildUser());
      mockKeycloakAdminService.revokeAllSessions.mockResolvedValue(undefined);
      mockPresenceService.markOffline.mockResolvedValue(undefined);

      const result = await service.adminRevokeAllSessions('1', 7);
      expect(mockKeycloakAdminService.revokeAllSessions).toHaveBeenCalledWith(
        'kc-uuid',
      );
      expect(mockPresenceService.markOffline).toHaveBeenCalledWith('1');
      expect(mockAuditLogService.write).toHaveBeenCalled();
      expect(result).toEqual({ message: 'Sesiones revocadas' });
    });

    it('debe lanzar BadRequestException si el usuario no tiene external_id', async () => {
      mockUserRepository.findById.mockResolvedValue(
        buildUser({ external_id: null as unknown as string }),
      );
      await expect(service.adminRevokeAllSessions('1', 7)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // ADMIN REVOKE SESSION
  // ─────────────────────────────────────────────────────────────
  describe('adminRevokeSession', () => {
    it('debe revocar la sesión específica y auditar', async () => {
      mockUserRepository.findById.mockResolvedValue(buildUser());
      mockKeycloakAdminService.getUserSessions.mockResolvedValue([
        { id: 's1', ipAddress: '1.2.3.4', start: 100 },
        { id: 's2', ipAddress: '5.6.7.8', start: 200 },
      ]);
      mockKeycloakAdminService.revokeSession.mockResolvedValue(undefined);

      const result = await service.adminRevokeSession('1', 's2', 7);
      expect(mockKeycloakAdminService.revokeSession).toHaveBeenCalledWith('s2');
      expect(mockAuditLogService.write).toHaveBeenCalled();
      expect(result).toEqual({ message: 'Sesión revocada' });
    });

    it('debe lanzar BadRequestException si la sesión no existe', async () => {
      mockUserRepository.findById.mockResolvedValue(buildUser());
      mockKeycloakAdminService.getUserSessions.mockResolvedValue([
        { id: 's1', ipAddress: '1.2.3.4', start: 100 },
      ]);

      await expect(service.adminRevokeSession('1', 's9', 7)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockKeycloakAdminService.revokeSession).not.toHaveBeenCalled();
    });

    it('debe lanzar BadRequestException si el usuario no tiene external_id', async () => {
      mockUserRepository.findById.mockResolvedValue(
        buildUser({ external_id: null as unknown as string }),
      );
      await expect(service.adminRevokeSession('1', 's1', 7)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});

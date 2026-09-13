import { AdminUserController } from '@identity/controller/admin-user.controller';
import { UserService } from '@identity/service/user.service';
import { UpdateUserRolesDto } from '@identity/dto/user/update-user-roles.dto';
import { UpdateUserStatusDto } from '@identity/dto/user/update-user-status.dto';
import { IntrospectResponse } from '@auth/interfaces/IntrospectResponse.dto';

const mockUserService = {
  findAllUsers: jest.fn(),
  findAdminUserDetail: jest.fn(),
  updateUserStatus: jest.fn(),
  updateUserRoles: jest.fn(),
  adminResetPassword: jest.fn(),
  adminRevokeAllSessions: jest.fn(),
  adminRevokeSession: jest.fn(),
};

const admin: IntrospectResponse = {
  sub: 'kc-admin',
  userId: 99,
  username: 'admin',
  realm_access: { roles: ['user', 'admin'] },
} as IntrospectResponse;

describe('AdminUserController', () => {
  let controller: AdminUserController;

  beforeEach(() => {
    controller = new AdminUserController(
      mockUserService as unknown as UserService,
    );
    jest.clearAllMocks();
  });

  it('lista usuarios con query', async () => {
    const payload = { data: [], total: 0 };
    mockUserService.findAllUsers.mockResolvedValue(payload);
    const result = await controller.findAll({ page: 1, limit: 20 });
    expect(mockUserService.findAllUsers).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
    });
    expect(result).toEqual(payload);
  });

  it('obtiene detalle admin', async () => {
    const detail = { user: { id: '1' }, sessions: [], accessHistory: [] };
    mockUserService.findAdminUserDetail.mockResolvedValue(detail);
    await expect(controller.findOne('1')).resolves.toEqual(detail);
    expect(mockUserService.findAdminUserDetail).toHaveBeenCalledWith('1');
  });

  it('actualiza estado', async () => {
    const dto: UpdateUserStatusDto = { is_active: false };
    mockUserService.updateUserStatus.mockResolvedValue({
      id: '1',
      is_active: false,
    });
    const result = await controller.updateStatus('1', dto, admin);
    expect(mockUserService.updateUserStatus).toHaveBeenCalledWith(
      '1',
      false,
      99,
    );
    expect(result.is_active).toBe(false);
  });

  it('actualiza roles', async () => {
    const dto: UpdateUserRolesDto = { roles: ['user', 'admin'] };
    mockUserService.updateUserRoles.mockResolvedValue({
      id: '1',
      roles: dto.roles,
    });
    const result = await controller.updateRoles('1', dto, admin);
    expect(mockUserService.updateUserRoles).toHaveBeenCalledWith(
      '1',
      dto.roles,
      99,
    );
    expect(result.roles).toEqual(dto.roles);
  });

  it('envía reset de contraseña', async () => {
    mockUserService.adminResetPassword.mockResolvedValue({
      message: 'Email de restablecimiento enviado',
    });
    await expect(controller.resetPassword('1', admin)).resolves.toEqual({
      message: 'Email de restablecimiento enviado',
    });
    expect(mockUserService.adminResetPassword).toHaveBeenCalledWith('1', 99);
  });

  it('revoca todas las sesiones', async () => {
    mockUserService.adminRevokeAllSessions.mockResolvedValue({
      message: 'Sesiones revocadas',
    });
    await expect(controller.revokeAllSessions('1', admin)).resolves.toEqual({
      message: 'Sesiones revocadas',
    });
  });

  it('revoca una sesión específica', async () => {
    mockUserService.adminRevokeSession.mockResolvedValue({
      message: 'Sesión revocada',
    });
    await expect(
      controller.revokeSession('1', 'sess-1', admin),
    ).resolves.toEqual({ message: 'Sesión revocada' });
    expect(mockUserService.adminRevokeSession).toHaveBeenCalledWith(
      '1',
      'sess-1',
      99,
    );
  });
});

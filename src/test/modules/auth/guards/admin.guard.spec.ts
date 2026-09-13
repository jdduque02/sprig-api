import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { AdminGuard } from '@auth/guards/admin.guard';

const mockI18n = {
  t: jest.fn((key: string) => key),
};

const buildContext = (user: unknown): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as unknown as ExecutionContext;

describe('AdminGuard', () => {
  let guard: AdminGuard;

  beforeEach(() => {
    guard = new AdminGuard(mockI18n as unknown as I18nService);
    jest.clearAllMocks();
  });

  it('debe permitir el acceso a usuarios con rol admin', () => {
    const ctx = buildContext({
      active: true,
      userId: 1,
      realm_access: { roles: ['user', 'admin'] },
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('debe lanzar UnauthorizedException si no hay usuario autenticado', () => {
    const ctx = buildContext(undefined);
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('debe lanzar ForbiddenException si el usuario no tiene rol admin', () => {
    const ctx = buildContext({
      active: true,
      userId: 2,
      realm_access: { roles: ['user'] },
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('debe lanzar ForbiddenException si no trae realm_access', () => {
    const ctx = buildContext({ active: true, userId: 2 });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});

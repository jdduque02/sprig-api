import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { AuthGuard } from '@auth/guards/auth.guard';
import { AuthService } from '@auth/service/auth.service';

const mockAuthService = {
  introspect: jest.fn(),
};

const mockI18n = {
  t: jest.fn((key: string) => key),
};

const buildContext = (authorization?: string): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization }, cookies: {} }),
    }),
  }) as unknown as ExecutionContext;

describe('AuthGuard', () => {
  let guard: AuthGuard;

  beforeEach(() => {
    guard = new AuthGuard(
      mockAuthService as unknown as AuthService,
      mockI18n as unknown as I18nService,
    );
    jest.clearAllMocks();
  });

  it('debe permitir el acceso con token activo', async () => {
    mockAuthService.introspect.mockResolvedValue({
      active: true,
      sub: 'user-uuid',
    });
    const ctx = buildContext('Bearer valid-token');
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(mockAuthService.introspect).toHaveBeenCalledWith('valid-token');
  });

  it('debe lanzar UnauthorizedException si no se provee Authorization', async () => {
    const ctx = buildContext(undefined);
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('debe lanzar UnauthorizedException si el header no empieza con Bearer', async () => {
    const ctx = buildContext('Basic dXNlcjpwYXNz');
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('debe lanzar UnauthorizedException si el token está inactivo', async () => {
    mockAuthService.introspect.mockResolvedValue({ active: false });
    const ctx = buildContext('Bearer expired-token');
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('debe adjuntar el payload al request.user cuando el token es válido', async () => {
    const payload = { active: true, sub: 'user-uuid', username: 'admin' };
    mockAuthService.introspect.mockResolvedValue(payload);
    const request: { headers: { authorization: string }; user?: unknown } = {
      headers: { authorization: 'Bearer valid-token' },
    };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    await guard.canActivate(ctx);
    expect(request.user).toEqual(payload);
  });
});

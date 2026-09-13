import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { OwnershipGuard } from '@auth/guards/ownership.guard';

const mockI18n = { t: jest.fn((key: string) => key) };

const buildContext = (
  user: { userId?: number } | Record<string, never> | undefined,
  params: Record<string, string> = {},
): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ user, params }),
    }),
  }) as unknown as ExecutionContext;

describe('OwnershipGuard', () => {
  let guard: OwnershipGuard;

  beforeEach(() => {
    guard = new OwnershipGuard(mockI18n as unknown as I18nService);
    jest.clearAllMocks();
  });

  it('permite acceso cuando userId de ruta coincide', () => {
    const ctx = buildContext({ userId: 5 }, { userId: '5' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('permite acceso cuando userId viene por :id', () => {
    const ctx = buildContext({ userId: 7 }, { id: '7' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('lanza UnauthorizedException si no hay userId', () => {
    const ctx = buildContext({});
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('lanza ForbiddenException si userId no coincide', () => {
    const ctx = buildContext({ userId: 5 }, { userId: '9' });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('lanza ForbiddenException si el parámetro no es numérico', () => {
    const ctx = buildContext({ userId: 5 }, { userId: 'abc' });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});

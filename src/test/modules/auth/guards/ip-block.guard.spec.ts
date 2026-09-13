import { BadRequestException, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { I18nService } from 'nestjs-i18n';
import { IpBlockGuard, IP_BLOCK_KEY } from '@auth/guards/ip-block.guard';
import { IpBlockService } from '@shared/services/ip-block.service';

const mockIpBlockService = { isBlocked: jest.fn() };
const mockReflector = { getAllAndOverride: jest.fn() };
const mockI18n = { t: jest.fn((key: string) => key) };

const buildContext = (request: Record<string, any>): ExecutionContext =>
  ({
    getHandler: () => () => ({}),
    getClass: () => () => ({}),
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({ setHeader: jest.fn() }),
    }),
  }) as unknown as ExecutionContext;

describe('IpBlockGuard', () => {
  let guard: IpBlockGuard;

  beforeEach(() => {
    guard = new IpBlockGuard(
      mockIpBlockService as unknown as IpBlockService,
      mockReflector as unknown as Reflector,
      mockI18n as unknown as I18nService,
    );
    jest.clearAllMocks();
    mockReflector.getAllAndOverride.mockReturnValue(undefined);
    mockIpBlockService.isBlocked.mockResolvedValue(false);
  });

  it('salta si la metadata SkipIpBlock está activa', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(true);
    const ctx = buildContext({});
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(IP_BLOCK_KEY, [
      expect.any(Function),
      expect.any(Function),
    ]);
  });

  it('permite si la IP no está bloqueada', async () => {
    const ctx = buildContext({ headers: {}, ip: '10.0.0.1' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(mockIpBlockService.isBlocked).toHaveBeenCalledWith('10.0.0.1');
  });

  it('usa x-forwarded-for para extraer la IP', async () => {
    const ctx = buildContext({
      headers: { 'x-forwarded-for': '1.2.3.4, 9.9.9.9' },
    });
    await guard.canActivate(ctx);
    expect(mockIpBlockService.isBlocked).toHaveBeenCalledWith('1.2.3.4');
  });

  it('usa x-real-ip si no hay x-forwarded-for', async () => {
    const ctx = buildContext({ headers: { 'x-real-ip': '5.6.7.8' } });
    await guard.canActivate(ctx);
    expect(mockIpBlockService.isBlocked).toHaveBeenCalledWith('5.6.7.8');
  });

  it('lanza BadRequestException si la IP está bloqueada', async () => {
    mockIpBlockService.isBlocked.mockResolvedValue(true);
    const ctx = buildContext({ headers: {}, ip: '10.0.0.1' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(BadRequestException);
  });

  it('cae en unknown si no hay IP disponible', async () => {
    const ctx = buildContext({ headers: {}, socket: {} });
    await guard.canActivate(ctx);
    expect(mockIpBlockService.isBlocked).toHaveBeenCalledWith('unknown');
  });
});

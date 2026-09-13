import { ConfigService } from '@nestjs/config';
import { IpBlockService } from '@shared/services/ip-block.service';

describe('IpBlockService', () => {
  let service: IpBlockService;
  const cacheMock = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };
  const configMock = {
    get: jest.fn((_key: string, def: unknown) => def),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new IpBlockService(
      cacheMock as never,
      configMock as unknown as ConfigService,
    );
  });

  it('isBlocked devuelve true cuando la IP está bloqueada', async () => {
    cacheMock.get.mockResolvedValue('blocked');
    await expect(service.isBlocked('1.2.3.4')).resolves.toBe(true);
  });

  it('isBlocked devuelve false cuando no hay bloqueo', async () => {
    cacheMock.get.mockResolvedValue(null);
    await expect(service.isBlocked('1.2.3.4')).resolves.toBe(false);
  });

  it('recordFailedAttempt bloquea al alcanzar el máximo', async () => {
    cacheMock.get.mockResolvedValue(4);
    cacheMock.set.mockResolvedValue(undefined);
    const result = await service.recordFailedAttempt('1.2.3.4');
    expect(result.blocked).toBe(true);
    expect(result.remainingAttempts).toBe(0);
    expect(cacheMock.set).toHaveBeenCalled();
  });

  it('recordFailedAttempt acumula intentos sin bloquear', async () => {
    cacheMock.get.mockResolvedValue(1);
    const result = await service.recordFailedAttempt('1.2.3.4');
    expect(result.blocked).toBe(false);
    expect(result.remainingAttempts).toBe(3);
  });

  it('recordFailedAttempt empieza en 1 si no hay intentos previos', async () => {
    cacheMock.get.mockResolvedValue(null);
    const result = await service.recordFailedAttempt('1.2.3.4');
    expect(result.remainingAttempts).toBe(4);
  });

  it('resetAttempts borra los intentos', async () => {
    cacheMock.del.mockResolvedValue(undefined);
    await service.resetAttempts('1.2.3.4');
    expect(cacheMock.del).toHaveBeenCalled();
  });

  it('blockIp marca la IP como bloqueada', async () => {
    cacheMock.set.mockResolvedValue(undefined);
    await service.blockIp('1.2.3.4');
    expect(cacheMock.set).toHaveBeenCalled();
  });

  it('getRemainingBlockTime devuelve la duración si está bloqueada', async () => {
    cacheMock.get.mockResolvedValue('blocked');
    await expect(service.getRemainingBlockTime('1.2.3.4')).resolves.toBe(
      900_000,
    );
  });

  it('getRemainingBlockTime devuelve 0 si no está bloqueada', async () => {
    cacheMock.get.mockResolvedValue(null);
    await expect(service.getRemainingBlockTime('1.2.3.4')).resolves.toBe(0);
  });

  it('getLimits expone los límites', () => {
    expect(service.getLimits()).toMatchObject({ maxAttempts: 5 });
  });
});

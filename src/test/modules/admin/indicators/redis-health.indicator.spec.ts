import { RedisHealthIndicator } from '@admin/indicators/redis-health.indicator';
import { HealthIndicatorService } from '@nestjs/terminus';
import type { Cache } from 'cache-manager';

describe('RedisHealthIndicator', () => {
  let indicator: RedisHealthIndicator;
  let healthIndicatorService: HealthIndicatorService;
  let cacheManager: jest.Mocked<Cache>;

  beforeEach(() => {
    healthIndicatorService = new HealthIndicatorService();
    cacheManager = {
      set: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
    } as unknown as jest.Mocked<Cache>;
    indicator = new RedisHealthIndicator(healthIndicatorService, cacheManager);
  });

  it('debe reportar "up" cuando el round-trip set/get coincide', async () => {
    cacheManager.set.mockResolvedValue(undefined);
    cacheManager.get.mockResolvedValue('ok');

    const result = await indicator.pingCheck('redis');

    expect(cacheManager.set).toHaveBeenCalledWith(
      'health:redis:probe',
      'ok',
      5_000,
    );
    expect(result).toEqual({ redis: { status: 'up' } });
  });

  it('debe reportar "down" cuando el valor recuperado no coincide', async () => {
    cacheManager.set.mockResolvedValue(undefined);
    cacheManager.get.mockResolvedValue('otro-valor');

    const result = await indicator.pingCheck('redis');

    expect(result.redis.status).toBe('down');
  });

  it('debe reportar "down" cuando cacheManager.set lanza un error', async () => {
    cacheManager.set.mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await indicator.pingCheck('redis');

    expect(result.redis.status).toBe('down');
  });

  it('debe respetar el timeout configurado', async () => {
    cacheManager.set.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 50)),
    );
    cacheManager.get.mockResolvedValue('ok');

    const result = await indicator.pingCheck('redis', 5);

    expect(result.redis.status).toBe('down');
  });
});

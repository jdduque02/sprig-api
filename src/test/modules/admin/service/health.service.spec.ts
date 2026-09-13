import { HealthService } from '@admin/service/health.service';
import type { HealthCheckService } from '@nestjs/terminus';
import type { TypeOrmHealthIndicator } from '@nestjs/terminus';
import type { RedisHealthIndicator } from '@admin/indicators/redis-health.indicator';
import type {
  MicroserviceHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
  HttpHealthIndicator,
} from '@nestjs/terminus';
import type { ConfigService } from '@nestjs/config';

type IndicatorFn = () => unknown;

describe('HealthService', () => {
  let service: HealthService;

  const mockHealthCheckService = {
    check: jest.fn(),
  };
  const mockDb = { pingCheck: jest.fn() };
  const mockRedis = { pingCheck: jest.fn() };
  const mockMicroservice = { pingCheck: jest.fn() };
  const mockMemory = { checkHeap: jest.fn(), checkRSS: jest.fn() };
  const mockDisk = { checkStorage: jest.fn() };
  const mockHttp = { pingCheck: jest.fn() };

  const buildConfig = (overrides: Record<string, unknown> = {}) => {
    const values: Record<string, unknown> = {
      KEYCLOAK_URL: 'https://keycloak.local',
      KEYCLOAK_REALM: 'sprig',
      ...overrides,
    };
    return {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        if (key in values) return values[key];
        return defaultValue;
      }),
    };
  };

  const setUp = (configOverrides: Record<string, unknown> = {}) => {
    jest.clearAllMocks();

    mockHealthCheckService.check.mockImplementation(
      async (indicators: IndicatorFn[]) => {
        const results = (await Promise.all(
          indicators.map((fn) => fn()),
        )) as Record<string, unknown>[];
        const info: Record<string, unknown> = results.reduce(
          (acc, entry) => ({ ...acc, ...entry }),
          {} as Record<string, unknown>,
        );
        return { status: 'ok', info, error: {}, details: info };
      },
    );
    mockDb.pingCheck.mockResolvedValue({ database: { status: 'up' } });
    mockRedis.pingCheck.mockResolvedValue({ redis: { status: 'up' } });
    mockMicroservice.pingCheck.mockResolvedValue({
      rabbitmq: { status: 'up' },
    });
    mockMemory.checkHeap.mockResolvedValue({ memory_heap: { status: 'up' } });
    mockMemory.checkRSS.mockResolvedValue({ memory_rss: { status: 'up' } });
    mockDisk.checkStorage.mockResolvedValue({ disk: { status: 'up' } });
    mockHttp.pingCheck.mockResolvedValue({ keycloak: { status: 'up' } });

    const configService = buildConfig(configOverrides);

    service = new HealthService(
      mockHealthCheckService as unknown as HealthCheckService,
      mockDb as unknown as TypeOrmHealthIndicator,
      mockRedis as unknown as RedisHealthIndicator,
      mockMicroservice as unknown as MicroserviceHealthIndicator,
      mockMemory as unknown as MemoryHealthIndicator,
      mockDisk as unknown as DiskHealthIndicator,
      mockHttp as unknown as HttpHealthIndicator,
      configService as unknown as ConfigService,
    );
  };

  beforeEach(() => {
    setUp();
  });

  it('debe delegar en HealthCheckService.check con todos los indicadores', async () => {
    const result = (await service.check()) as { info: Record<string, unknown> };

    expect(mockHealthCheckService.check).toHaveBeenCalledTimes(1);
    expect(mockDb.pingCheck).toHaveBeenCalledWith('database');
    expect(mockRedis.pingCheck).toHaveBeenCalledWith('redis');
    expect(mockMicroservice.pingCheck).toHaveBeenCalledWith(
      'rabbitmq',
      expect.objectContaining({ transport: expect.any(Number) as number }),
    );
    expect(mockMemory.checkHeap).toHaveBeenCalledWith(
      'memory_heap',
      300 * 1024 * 1024,
    );
    expect(mockMemory.checkRSS).toHaveBeenCalledWith(
      'memory_rss',
      300 * 1024 * 1024,
    );
    expect(mockDisk.checkStorage).toHaveBeenCalledWith('disk', {
      path: expect.any(String) as string,
      thresholdPercent: 0.9,
    });
    expect(mockHttp.pingCheck).toHaveBeenCalledWith(
      'keycloak',
      'https://keycloak.local/realms/sprig',
      { timeout: 3000 },
    );
    expect(result.info).toEqual(
      expect.objectContaining({
        database: { status: 'up' },
        redis: { status: 'up' },
        rabbitmq: { status: 'up' },
        keycloak: { status: 'up' },
      }),
    );
  });

  it('debe omitir el check de Keycloak cuando no hay configuración', async () => {
    setUp({ KEYCLOAK_URL: undefined, KEYCLOAK_REALM: undefined });

    await service.check();

    expect(mockHttp.pingCheck).not.toHaveBeenCalled();
  });

  it('debe usar los umbrales de memoria/disco configurados por env', async () => {
    setUp({
      HEALTH_MEMORY_HEAP_MB: 512,
      HEALTH_MEMORY_RSS_MB: 256,
      HEALTH_DISK_THRESHOLD_PERCENT: 0.75,
      HEALTH_DISK_PATH: '/data',
    });

    await service.check();

    expect(mockMemory.checkHeap).toHaveBeenCalledWith(
      'memory_heap',
      512 * 1024 * 1024,
    );
    expect(mockMemory.checkRSS).toHaveBeenCalledWith(
      'memory_rss',
      256 * 1024 * 1024,
    );
    expect(mockDisk.checkStorage).toHaveBeenCalledWith('disk', {
      path: '/data',
      thresholdPercent: 0.75,
    });
  });
});

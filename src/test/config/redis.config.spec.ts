import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisConfig } from '@config/redis.config';

// Mockear redisStore para evitar conexiones reales a Redis
jest.mock('cache-manager-redis-yet', () => ({
  redisStore: jest.fn(),
}));

import { redisStore } from 'cache-manager-redis-yet';

interface RedisStoreOptionsShape {
  socket: { host: string; port: number };
  password?: string;
  ttl: number;
}

type RedisFactory = (
  configService: ConfigService,
) => Promise<{ store: unknown }>;

const mockRedisStore = redisStore as jest.Mock;

describe('redisConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedisStore.mockResolvedValue({ name: 'redis' });
  });

  it('debe exportar un objeto CacheModuleAsyncOptions válido', () => {
    expect(redisConfig).toBeDefined();
    expect(redisConfig.isGlobal).toBe(true);
    expect(redisConfig.imports).toContain(ConfigModule);
    expect(redisConfig.inject).toContain(ConfigService);
    expect(typeof redisConfig.useFactory).toBe('function');
  });

  describe('useFactory', () => {
    const buildStore = (env: Record<string, string | number | undefined>) => {
      const mockConfigService = {
        get: jest.fn(
          (key: string, defaultVal?: unknown) => env[key] ?? defaultVal,
        ),
      } as unknown as ConfigService;
      return (redisConfig.useFactory as unknown as RedisFactory)(
        mockConfigService,
      );
    };

    it('debe llamar a redisStore con los valores del entorno', async () => {
      await buildStore({
        REDIS_HOST: 'redis-server',
        REDIS_PORT: 6380,
        REDIS_PASSWORD: 'secret',
      });

      expect(mockRedisStore).toHaveBeenCalledTimes(1);
      const [options] = mockRedisStore.mock.calls[0] as [
        RedisStoreOptionsShape,
      ];
      expect(options.socket.host).toBe('redis-server');
      expect(options.socket.port).toBe(6380);
      expect(options.password).toBe('secret');
    });

    it('debe usar "localhost" como host por defecto si REDIS_HOST no está definido', async () => {
      await buildStore({ REDIS_HOST: undefined, REDIS_PORT: undefined });

      const [options] = mockRedisStore.mock.calls[0] as [
        RedisStoreOptionsShape,
      ];
      expect(options.socket.host).toBe('localhost');
    });

    it('debe usar el puerto 6379 por defecto si REDIS_PORT no está definido', async () => {
      await buildStore({ REDIS_PORT: undefined });

      const [options] = mockRedisStore.mock.calls[0] as [
        RedisStoreOptionsShape,
      ];
      expect(options.socket.port).toBe(6379);
    });

    it('debe establecer password como undefined si REDIS_PASSWORD no está definida', async () => {
      await buildStore({ REDIS_PASSWORD: undefined });

      const [options] = mockRedisStore.mock.calls[0] as [
        RedisStoreOptionsShape,
      ];
      expect(options.password).toBeUndefined();
    });

    it('debe establecer el TTL en 60000ms (1 minuto)', async () => {
      await buildStore({});

      const [options] = mockRedisStore.mock.calls[0] as [
        RedisStoreOptionsShape,
      ];
      expect(options.ttl).toBe(60 * 1000);
    });

    it('debe retornar el store devuelto por redisStore', async () => {
      const fakeStore = { name: 'redis-mock' };
      mockRedisStore.mockResolvedValue(fakeStore);

      const result = await buildStore({});
      expect(result.store).toBe(fakeStore);
    });

    it('debe propagar el error si redisStore falla', async () => {
      mockRedisStore.mockRejectedValue(new Error('Conexión rechazada'));

      await expect(buildStore({})).rejects.toThrow('Conexión rechazada');
    });
  });
});

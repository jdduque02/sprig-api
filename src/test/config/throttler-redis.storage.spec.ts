import { ConfigService } from '@nestjs/config';
import { ThrottlerStorageRedisService } from '@config/throttler-redis.storage';

const redisState = {
  get: jest.fn(),
  pttl: jest.fn(),
  multi: jest.fn(),
  set: jest.fn(),
  quit: jest.fn(),
  disconnect: jest.fn(),
  on: jest.fn(),
};

jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => redisState),
}));

const mockConfig = {
  get: jest.fn((key: string) =>
    key === 'REDIS_HOST' ? 'localhost' : undefined,
  ),
};

describe('ThrottlerStorageRedisService', () => {
  let storage: ThrottlerStorageRedisService;

  beforeEach(() => {
    jest.clearAllMocks();
    storage = new ThrottlerStorageRedisService(
      mockConfig as unknown as ConfigService,
    );
  });

  it('construye el cliente y registra el handler de error', () => {
    expect(redisState.on).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('loguea un warning cuando Redis emite un error', () => {
    const loggerWarnSpy = jest.spyOn((storage as any).logger, 'warn');
    const errorHandler = redisState.on.mock.calls.find(
      ([event]) => event === 'error',
    )?.[1] as (err: Error) => void;

    errorHandler(new Error('ECONNREFUSED'));

    expect(loggerWarnSpy).toHaveBeenCalledWith(
      'Redis throttler error: ECONNREFUSED',
    );
  });

  describe('increment', () => {
    it('retorna bloqueado cuando el bloqueo existe', async () => {
      redisState.get.mockResolvedValue('1');
      redisState.pttl.mockResolvedValue(5000);
      const result = await storage.increment(
        'key-1',
        60000,
        5,
        900000,
        'global',
      );
      expect(result).toEqual({
        totalHits: 6,
        timeToExpire: 60000,
        isBlocked: true,
        timeToBlockExpire: 5000,
      });
    });

    it('incrementa el contador vía multi y retorna estado no bloqueado', async () => {
      redisState.get.mockResolvedValue(null);
      const multi = {
        incr: jest.fn().mockReturnThis(),
        pexpire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([[null, 2]]),
      };
      redisState.multi.mockReturnValue(multi);
      redisState.pttl.mockResolvedValue(30000);

      const result = await storage.increment(
        'key-2',
        60000,
        5,
        900000,
        'global',
      );
      expect(result).toEqual({
        totalHits: 2,
        timeToExpire: 30000,
        isBlocked: false,
        timeToBlockExpire: 0,
      });
      expect(multi.incr).toHaveBeenCalledWith('throttle:global:key-2');
      expect(multi.pexpire).toHaveBeenCalledWith(
        'throttle:global:key-2',
        60000,
      );
    });

    it('activa el bloqueo y establece blockKey al exceder el límite', async () => {
      redisState.get.mockResolvedValue(null);
      const multi = {
        incr: jest.fn().mockReturnThis(),
        pexpire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([[null, 6]]),
      };
      redisState.multi.mockReturnValue(multi);
      redisState.pttl.mockResolvedValue(1000);

      const result = await storage.increment(
        'key-3',
        60000,
        5,
        900000,
        'global',
      );
      expect(result).toEqual({
        totalHits: 6,
        timeToExpire: 1000,
        isBlocked: true,
        timeToBlockExpire: 900000,
      });
      expect(redisState.set).toHaveBeenCalledWith(
        'throttle:global:key-3:block',
        '1',
        'PX',
        900000,
      );
    });
  });

  describe('onModuleDestroy', () => {
    it('cierra la conexión de Redis', async () => {
      redisState.quit.mockResolvedValue('OK');
      await storage.onModuleDestroy();
      expect(redisState.quit).toHaveBeenCalled();
    });

    it('desconecta si quit falla', async () => {
      redisState.quit.mockRejectedValue(new Error('boom'));
      await storage.onModuleDestroy();
      expect(redisState.disconnect).toHaveBeenCalled();
    });
  });
});

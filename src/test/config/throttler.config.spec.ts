import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getThrottlerConfig } from '@config/throttler.config';

type ThrottlerConfigShape = {
  throttlers: Array<{ ttl: number; limit: number }>;
  storage: unknown;
  errorMessage: (context: ExecutionContext) => string;
};

jest.mock('ioredis', () => {
  const redisState = {
    on: jest.fn(),
    get: jest.fn(),
    pttl: jest.fn(),
    multi: jest.fn(),
    set: jest.fn(),
    quit: jest.fn(),
    disconnect: jest.fn(),
  };
  return { __esModule: true, default: jest.fn(() => redisState) };
});

const mockConfig = {
  get: jest.fn(),
};

const buildHttpContext = (url: string): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ url }) }),
  }) as unknown as ExecutionContext;

const defaultingGet =
  (values: Record<string, string | number>) =>
  (key: string, defaultValue?: unknown) =>
    key in values ? values[key] : defaultValue;

const buildConfig = (): ThrottlerConfigShape =>
  getThrottlerConfig(
    mockConfig as unknown as ConfigService,
  ) as unknown as ThrottlerConfigShape;

describe('getThrottlerConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('usa límites de dev y valores por defecto', () => {
    mockConfig.get.mockImplementation(defaultingGet({}));
    const config = buildConfig();
    expect(config.throttlers).toHaveLength(2);
    expect(config.throttlers[0].limit).toBe(600);
    expect(config.throttlers[1].limit).toBe(10);
    expect(config.storage).toBeDefined();
  });

  it('usa límites restringidos en producción', () => {
    mockConfig.get.mockImplementation(defaultingGet({ NODE_ENV: 'PROD' }));
    const config = buildConfig();
    expect(config.throttlers[0].limit).toBe(120000);
    expect(config.throttlers[1].limit).toBe(5);
  });

  it('lee TTL y límites desde la configuración', () => {
    mockConfig.get.mockImplementation(
      defaultingGet({ THROTTLE_TTL_MS: 30000, THROTTLE_LIMIT: 100 }),
    );
    const config = buildConfig();
    expect(config.throttlers[0].ttl).toBe(30000);
    expect(config.throttlers[0].limit).toBe(100);
  });

  describe('errorMessage', () => {
    it('mensaje específico para login', () => {
      const config = buildConfig();
      expect(config.errorMessage(buildHttpContext('/auth/login'))).toContain(
        'inicio de sesión',
      );
    });

    it('mensaje específico para forgot-password', () => {
      const config = buildConfig();
      expect(
        config.errorMessage(buildHttpContext('/auth/forgot-password')),
      ).toContain('recuperación');
    });

    it('mensaje genérico para el resto', () => {
      const config = buildConfig();
      expect(config.errorMessage(buildHttpContext('/transactions'))).toBe(
        'Demasiadas solicitudes. Intente de nuevo más tarde.',
      );
    });
  });
});

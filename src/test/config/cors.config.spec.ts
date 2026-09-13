import { ConfigService } from '@nestjs/config';
import { getCorsConfig } from '@config/cors.config';

type CorsConfig = ReturnType<typeof getCorsConfig>;

type OriginFunction = (
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean | string) => void,
) => void;

const callOrigin = (
  config: CorsConfig,
  origin?: string,
): Promise<{ err: Error | null; allow?: boolean | string }> =>
  new Promise((resolve) => {
    const originFn = config.origin as unknown as OriginFunction;
    originFn(origin, (err, allow) => resolve({ err, allow }));
  });

describe('getCorsConfig', () => {
  let mockConfigService: Partial<ConfigService>;

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn(),
    };
  });

  it('should return permissive config for DEV environment', async () => {
    (mockConfigService.get as jest.Mock).mockImplementation((key: string) => {
      if (key === 'NODE_ENV') return 'DEV';
      return null;
    });

    const config = getCorsConfig(mockConfigService as ConfigService);

    expect(typeof config.origin).toBe('function');
    await expect(callOrigin(config, 'http://localhost:5173')).resolves.toEqual({
      err: null,
      allow: 'http://localhost:5173',
    });
    const blocked = await callOrigin(config, 'https://evil.com');
    expect(blocked.err).toBeInstanceOf(Error);

    expect(config.credentials).toBe(true);
    expect(config.methods).toEqual([
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS',
    ]);
    expect(config.allowedHeaders).toContain('X-CSRF-Token');
    expect(config.allowedHeaders).not.toContain('Cookie');
  });

  it('should return restricted config for PROD environment', async () => {
    const origins = 'https://example.com, https://api.example.com';
    (mockConfigService.get as jest.Mock).mockImplementation((key: string) => {
      if (key === 'NODE_ENV') return 'PROD';
      if (key === 'CORS_ORIGINS') return origins;
      return null;
    });

    const config = getCorsConfig(mockConfigService as ConfigService);

    expect(typeof config.origin).toBe('function');
    await expect(callOrigin(config, 'https://example.com')).resolves.toEqual({
      err: null,
      allow: 'https://example.com',
    });
    await expect(
      callOrigin(config, 'https://api.example.com'),
    ).resolves.toEqual({
      err: null,
      allow: 'https://api.example.com',
    });
    const blocked = await callOrigin(config, 'https://blocked.com');
    expect(blocked.err).toBeInstanceOf(Error);

    expect(config.credentials).toBe(true);
    expect(config.allowedHeaders).toContain('Authorization');
    expect(config.allowedHeaders).toContain('Content-Type');
    expect(config.allowedHeaders).not.toContain('Cookie');
    expect(config.allowedHeaders).not.toContain('Set-Cookie');
  });

  it('should block browser origins when CORS_ORIGINS is missing in PROD', async () => {
    (mockConfigService.get as jest.Mock).mockImplementation((key: string) => {
      if (key === 'NODE_ENV') return 'PROD';
      if (key === 'CORS_ORIGINS') return undefined;
      return null;
    });

    const config = getCorsConfig(mockConfigService as ConfigService);

    expect(typeof config.origin).toBe('function');
    await expect(callOrigin(config)).resolves.toEqual({
      err: null,
      allow: true,
    });
    const blocked = await callOrigin(config, 'https://unknown.com');
    expect(blocked.err).toBeInstanceOf(Error);
  });
});

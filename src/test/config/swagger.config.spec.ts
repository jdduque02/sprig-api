import { ConfigService } from '@nestjs/config';
import { getSwaggerConfig } from '@config/swagger.config';

interface SwaggerShape {
  components: { securitySchemes: Record<string, unknown> };
  servers: { url: string; description: string }[];
}

describe('getSwaggerConfig', () => {
  const buildConfig = (env: Record<string, string | undefined>) => {
    const mockConfigService = {
      get: jest.fn((key: string) => env[key]),
    } as unknown as ConfigService;
    return getSwaggerConfig(mockConfigService);
  };

  it('debe incluir el environment en la descripción', () => {
    const config = buildConfig({ NODE_ENV: 'DEV', VERSION: '1' });
    expect(config.info.description).toContain('DEV');
  });

  it('debe usar "LOCAL" como entorno por defecto si NODE_ENV no está definido', () => {
    const config = buildConfig({ NODE_ENV: undefined, VERSION: '1' });
    expect(config.info.description).toContain('LOCAL');
  });

  it('debe usar "1" como versión por defecto si VERSION no está definida', () => {
    const config = buildConfig({ NODE_ENV: 'DEV', VERSION: undefined });
    expect(config.info.version).toBe('1');
  });

  it('debe incluir la versión del entorno en info.version', () => {
    const config = buildConfig({ NODE_ENV: 'PROD', VERSION: '3' });
    expect(config.info.version).toBe('3');
  });

  it('debe registrar el esquema BearerAuth', () => {
    const config = buildConfig({ NODE_ENV: 'DEV', VERSION: '1' });
    const schemes = (config as unknown as SwaggerShape).components
      ?.securitySchemes;
    expect(schemes).toBeDefined();
    expect(Object.keys(schemes)).toContain('bearer');
  });

  it('debe tener tags de dominio', () => {
    const config = buildConfig({ NODE_ENV: 'DEV', VERSION: '1' });
    const tagNames = (config.tags ?? []).map((t) => t.name);
    expect(tagNames).toContain('identity');
    expect(tagNames).toContain('banking');
    expect(tagNames).toContain('finance');
    expect(tagNames).toContain('intelligence');
    expect(tagNames).toContain('auth');
    expect(tagNames).toContain('audit');
  });

  it('debe agregar un server por defecto para LOCAL', () => {
    const config = buildConfig({ NODE_ENV: 'LOCAL', VERSION: '1' });
    const servers = (config as unknown as SwaggerShape).servers;
    expect(servers).toBeDefined();
    expect(servers.length).toBe(1);
    expect(servers[0].url).toContain('localhost');
    expect(servers[0].description).toContain('LOCAL');
  });

  it('debe agregar un server para DEV', () => {
    const config = buildConfig({ NODE_ENV: 'DEV', VERSION: '1' });
    const servers = (config as unknown as SwaggerShape).servers;
    expect(servers).toBeDefined();
    expect(servers[0].url).toContain('api-dev');
    expect(servers[0].description).toContain('DEV');
  });

  it('debe agregar un server para PROD', () => {
    const config = buildConfig({ NODE_ENV: 'PROD', VERSION: '2' });
    const servers = (config as unknown as SwaggerShape).servers;
    expect(servers).toBeDefined();
    expect(servers[0].url).toContain('api.costmanager.com');
    expect(servers[0].description).toContain('PROD');
  });

  it('debe incluir la versión en la descripción del server', () => {
    const config = buildConfig({ NODE_ENV: 'LOCAL', VERSION: '2' });
    const servers = (config as unknown as SwaggerShape).servers;
    expect(servers[0].url).toContain('localhost');
    expect(servers[0].description).toContain('(v2)');
  });
});

import { ConfigService } from '@nestjs/config';
import { databaseConfig } from '@config/database.config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

type DatabaseFactory = (configService: ConfigService) => TypeOrmModuleOptions;

describe('databaseConfig', () => {
  it('debe exportar un objeto TypeOrmModuleAsyncOptions válido', () => {
    expect(databaseConfig).toBeDefined();
    expect(typeof databaseConfig.useFactory).toBe('function');
    expect(databaseConfig.inject).toContain(ConfigService);
  });

  describe('useFactory', () => {
    const buildConfig = (env: Record<string, string | number | undefined>) => {
      const mockConfigService = {
        get: jest.fn(
          (key: string, defaultVal?: unknown) => env[key] ?? defaultVal,
        ),
      } as unknown as ConfigService;
      const factory = databaseConfig.useFactory as unknown as DatabaseFactory;
      return factory(mockConfigService);
    };

    it('debe retornar la configuración de PostgreSQL con los valores del entorno', () => {
      const config = buildConfig({
        DB_HOST: 'localhost',
        DB_PORT: 5432,
        DB_USER: 'admin',
        DB_PASSWORD: 'secret',
        DB_NAME: 'cost_manager',
        NODE_ENV: 'DEV',
      });

      expect(config.type).toBe('postgres');
      expect(config.host).toBe('localhost');
      expect(config.port).toBe(5432);
      expect(config.username).toBe('admin');
      expect(config.password).toBe('secret');
      expect(config.database).toBe('cost_manager');
    });

    it('debe activar synchronize cuando NODE_ENV no es PROD', () => {
      const config = buildConfig({ NODE_ENV: 'DEV' });
      expect(config.synchronize).toBe(true);
    });

    it('debe desactivar synchronize en entorno PROD', () => {
      const config = buildConfig({ NODE_ENV: 'PROD' });
      expect(config.synchronize).toBe(false);
    });

    it('debe incluir autoLoadEntities en true', () => {
      const config = buildConfig({ NODE_ENV: 'DEV' });
      expect(config.autoLoadEntities).toBe(true);
    });

    it('debe incluir pool de conexiones en extra', () => {
      const config = buildConfig({ NODE_ENV: 'DEV' });
      expect(config.extra).toMatchObject({
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
    });
  });
});

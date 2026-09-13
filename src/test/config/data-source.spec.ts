/**
 * `src/config/data-source.ts` es el DataSource de TypeORM usado únicamente por la
 * CLI de migraciones (`migration:run`, `migration:generate`, `migration:revert`),
 * ejecutado vía `ts-node` fuera del contexto de Nest. No expone una función/factory
 * (a diferencia de `database.config.ts`, que sí es un `useFactory` inyectable y ya
 * tiene su propio spec) sino que construye el `DataSource` como efecto secundario
 * de importar el módulo, leyendo `process.env` directamente.
 *
 * Para poder cubrirlo sin ejecutar una conexión real a Postgres, se mockean
 * `typeorm` (captura las opciones pasadas al constructor) y `dotenv` (evita leer
 * el `.env` real del filesystem), y se re-importa el módulo con `jest.isolateModules`
 * variando `process.env` para cubrir las ramas de `isProd` y `ssl`.
 */
describe('data-source (TypeORM DataSource para CLI de migraciones)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  const loadDataSource = (): unknown => {
    let dataSourceOptions: unknown;

    jest.doMock('dotenv', () => ({ config: jest.fn() }));
    jest.doMock('typeorm', () => ({
      DataSource: jest.fn().mockImplementation((options: unknown) => {
        dataSourceOptions = options;
        return { options };
      }),
    }));

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@config/data-source');
    });

    return dataSourceOptions;
  };

  it('debe construir un DataSource de tipo postgres con los valores de entorno', () => {
    process.env.DB_HOST = 'localhost';
    process.env.DB_PORT = '5432';
    process.env.DB_USER = 'admin';
    process.env.DB_PASSWORD = 'secret';
    process.env.DB_NAME = 'cost_manager';
    process.env.NODE_ENV = 'LOCAL';
    delete process.env.DB_SSL;

    const options = loadDataSource() as Record<string, unknown>;

    expect(options.type).toBe('postgres');
    expect(options.host).toBe('localhost');
    expect(options.port).toBe(5432);
    expect(options.username).toBe('admin');
    expect(options.password).toBe('secret');
    expect(options.database).toBe('cost_manager');
    expect(options.synchronize).toBe(false);
    expect(options.ssl).toBe(false);
    expect(options.logging).toEqual(['error', 'warn', 'migration']);
  });

  it('debe restringir el logging a error/warn en entornos de producción (PROD/DEPLOY/production)', () => {
    process.env.NODE_ENV = 'production';

    const options = loadDataSource() as Record<string, unknown>;

    expect(options.logging).toEqual(['error', 'warn']);
  });

  it('debe habilitar ssl con rejectUnauthorized=false cuando DB_SSL=true', () => {
    process.env.DB_SSL = 'true';

    const options = loadDataSource() as Record<string, unknown>;

    expect(options.ssl).toEqual({ rejectUnauthorized: false });
  });
});

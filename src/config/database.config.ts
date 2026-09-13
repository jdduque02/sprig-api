import {
  TypeOrmModuleAsyncOptions,
  TypeOrmModuleOptions,
} from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

export const databaseConfig: TypeOrmModuleAsyncOptions = {
  imports: [ConfigModule],
  useFactory: (configService: ConfigService): TypeOrmModuleOptions => {
    const env = configService.get<string>('NODE_ENV', 'LOCAL');
    const isProd = env === 'PROD' || env === 'DEPLOY' || env === 'production';
    const sslEnabled = configService.get<string>('DB_SSL', 'false') === 'true';
    const redisHost = configService.get<string>('REDIS_HOST', 'localhost');
    const redisPort = configService.get<number>('REDIS_PORT', 6379);
    const redisPassword =
      configService.get<string>('REDIS_PASSWORD') || undefined;

    return {
      type: 'postgres',
      host: configService.get<string>('DB_HOST'),
      port: configService.get<number>('DB_PORT'),
      username: configService.get<string>('DB_USER'),
      password: configService.get<string>('DB_PASSWORD'),
      database: configService.get<string>('DB_NAME'),
      entities: [__dirname + '/**/*.entity.{js,ts}'],
      autoLoadEntities: true,
      synchronize: !isProd,
      migrationsRun: true,
      migrations: [__dirname + '/../../migrations/*.{js,ts}'],
      retryAttempts: configService.get<number>('DB_RETRY_ATTEMPTS', 5),
      retryDelay: configService.get<number>('DB_RETRY_DELAY_MS', 3000),
      maxQueryExecutionTime: configService.get<number>('DB_MAX_QUERY_MS', 2000),
      logging: isProd ? ['error', 'warn'] : ['error', 'warn', 'migration'],
      ssl: sslEnabled ? { rejectUnauthorized: false } : false,
      // Query-result cache (TypeORM) backed by Redis/ioredis
      cache: {
        type: 'ioredis',
        options: {
          host: redisHost,
          port: redisPort,
          password: redisPassword,
          keyPrefix: 'typeorm:',
        },
        duration: configService.get<number>('DB_QUERY_CACHE_MS', 60_000),
        ignoreErrors: true,
      },
      extra: {
        max: configService.get<number>('DB_POOL_MAX', 20),
        min: configService.get<number>('DB_POOL_MIN', 2),
        idleTimeoutMillis: configService.get<number>('DB_POOL_IDLE_MS', 30_000),
        connectionTimeoutMillis: configService.get<number>(
          'DB_POOL_CONN_MS',
          5_000,
        ),
        application_name: 'cost-manager-api',
      },
    };
  },
  inject: [ConfigService],
};

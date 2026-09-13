import { ConfigService } from '@nestjs/config';
import { CorsOptions } from 'cors';

const DEFAULT_DEV_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:8081',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:8081',
];

export const getCorsConfig = (configService: ConfigService): CorsOptions => {
  const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
  const env = configService.get<string>('NODE_ENV', 'LOCAL');
  const isProd = env === 'PROD' || env === 'DEPLOY' || env === 'production';

  const fromEnv = configService
    .get<string>('CORS_ORIGINS')
    ?.split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  const origins =
    fromEnv && fromEnv.length > 0 ? fromEnv : isProd ? [] : DEFAULT_DEV_ORIGINS;

  return {
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean | string) => void,
    ) => {
      // Allow non-browser / same-origin tools (no Origin header)
      if (!origin) return callback(null, true);
      if (origins.includes(origin)) return callback(null, origin);
      return callback(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    credentials: true,
    methods,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-CSRF-Token',
      'X-Requested-With',
      'Accept',
      'Origin',
    ],
    exposedHeaders: ['X-CSRF-Token'],
  };
};

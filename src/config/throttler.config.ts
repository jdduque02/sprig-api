import { ThrottlerModuleOptions } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { ThrottlerStorageRedisService } from './throttler-redis.storage';

export const getThrottlerConfig = (
  configService: ConfigService,
): ThrottlerModuleOptions => {
  const isProd = configService.get<string>('NODE_ENV') === 'PROD';

  return {
    throttlers: [
      {
        // App personal de un solo usuario: cada página dispara ~10-15 GETs en
        // paralelo (dashboard, transacciones, patrimonio), así que 120/min en
        // dev se agotaba con el uso normal y bloqueaba todo durante 60s.
        name: 'global',
        ttl: configService.get<number>('THROTTLE_TTL_MS', 60_000),
        limit: configService.get<number>(
          'THROTTLE_LIMIT',
          isProd ? 120000 : 600,
        ),
      },
      {
        name: 'auth',
        ttl: configService.get<number>('THROTTLE_AUTH_TTL_MS', 60_000),
        limit: configService.get<number>(
          'THROTTLE_AUTH_LIMIT',
          isProd ? 5 : 10,
        ),
      },
    ],
    storage: new ThrottlerStorageRedisService(configService),
    errorMessage: (context) => {
      const req = context.switchToHttp().getRequest<Request>();
      const path = req?.url ?? '';
      if (path.includes('/auth/login')) {
        return 'Demasiados intentos de inicio de sesión. Intente de nuevo más tarde.';
      }
      if (path.includes('/auth/forgot-password')) {
        return 'Demasiadas solicitudes de recuperación de contraseña.';
      }
      return 'Demasiadas solicitudes. Intente de nuevo más tarde.';
    },
  };
};

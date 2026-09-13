/**
 * Los e2e disparan ráfagas de requests (medición de performance, casos de
 * error repetidos) contra el mismo `ThrottlerStorageRedisService` real que
 * usa la app en dev. El throttler 'auth' (10 req/min por defecto, ver
 * throttler.config.ts) se aplica a TODAS las rutas, no solo /auth/*, así
 * que se relaja aquí en vez de mockear el guard (overrideProvider(APP_GUARD)
 * no siempre reemplaza guards globales anidados vía imports en @nestjs/testing).
 */
process.env.THROTTLE_LIMIT = '100000';
process.env.THROTTLE_AUTH_LIMIT = '100000';

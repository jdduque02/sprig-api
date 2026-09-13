import request from 'supertest';
import { App } from 'supertest/types';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import {
  createTestApp,
  closeTestApp,
  TestAppContext,
} from '../../utils/e2e-app.helper';
import { authHeader } from '../../utils/test-auth.helper';
import { measure, expectFasterThan, PERF } from '../../utils/perf.helper';
import { unwrapOne } from '../../utils/response.helper';

/**
 * `AuthController` es el único módulo que en producción habla con Keycloak
 * real (login, refresh, verify-otp/reset-password contra Keycloak, sesiones,
 * historial de accesos). En este entorno de e2e Keycloak NO está disponible
 * de forma confiable (`docker compose up -d keycloak` en este host queda en
 * crash-loop), así que este spec cubre SOLO las rutas/ramas que no dependen
 * de una respuesta real de Keycloak:
 *  - Validación de DTO (400) en todos los endpoints públicos.
 *  - `POST /auth/encrypt`: criptografía local (AES-256-GCM), sin Keycloak.
 *  - `POST /auth/introspect` sin token: falla antes de tocar Keycloak (401).
 *  - `POST /auth/forgot-password`: el lookup en Keycloak está envuelto en
 *    try/catch y siempre responde 204 sin filtrar si el email existe.
 *  - `POST /auth/reset-password` con reset_token malformado: se valida el
 *    HMAC local antes de tocar Keycloak.
 *  - `POST /auth/logout` sin refresh_token (ni cookie): no llama a Keycloak.
 *  - Guards propios testeables sin red externa: `AuthGuard` (401) en las
 *    rutas de sesión.
 * Endpoints que SÍ requieren una respuesta real de Keycloak para completar
 * su flujo feliz y quedan FUERA de este e2e (documentado también en el
 * resumen del PR): `POST /auth/login` (credenciales válidas),
 * `POST /auth/refresh` (refresh_token válido), `POST /auth/verify-otp`
 * (requiere OTP real generado vía forgot-password + Keycloak accesible),
 * `POST /auth/change-password`, `GET /auth/sessions`,
 * `DELETE /auth/sessions/:sessionId`, `GET /auth/access-history` (todas
 * necesitan `KeycloakAdminService` contra un realm real).
 */
describe('AuthController (e2e)', () => {
  let ctx: TestAppContext;
  let server: App;

  const userId = 950001;

  beforeAll(async () => {
    ctx = await createTestApp();
    server = ctx.app.getHttpServer() as App;

    // Los `@Throttle({ auth: { limit: N } })` en `AuthController` son valores
    // literales por-ruta que NO leen `THROTTLE_AUTH_LIMIT` (ese env var sólo
    // relaja el límite default del throttler nombrado 'auth' a nivel de
    // módulo, ver `throttler.config.ts` vs `auth.controller.ts` — hallazgo:
    // el comentario de `test/utils/env-setup.ts` sobre "se aplica a TODAS las
    // rutas" ya no es preciso para este controller). El storage es Redis real
    // y persiste 60s entre corridas de este mismo spec, así que se limpian
    // las claves de este bucket antes de correr para no heredar el cupo
    // consumido por ejecuciones anteriores.
    const configService = ctx.moduleRef.get(ConfigService);
    const redis = new Redis({
      host: configService.get<string>('REDIS_HOST', 'localhost'),
      port: configService.get<number>('REDIS_PORT', 6379),
      password: configService.get<string>('REDIS_PASSWORD') || undefined,
      lazyConnect: false,
    });
    const keys = await redis.keys('throttle:auth:*');
    if (keys.length) {
      await redis.del(...keys);
    }
    await redis.quit();
  });

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  describe('flujo feliz completo (rutas sin dependencia de Keycloak real)', () => {
    it('POST /auth/encrypt encripta una contraseña localmente (AES-256-GCM)', async () => {
      const { result: res, durationMs } = await measure(() =>
        request(server)
          .post('/api/v1/auth/encrypt')
          .send({ password: 'MiContraseñaSegura123!' }),
      );

      expect(res.status).toBe(200);
      const body = unwrapOne<{ encrypted_password: string }>(res.body);
      // formato base64iv:base64authTag:base64ciphertext (EncryptionService)
      expect(body.encrypted_password.split(':')).toHaveLength(3);
      expectFasterThan(durationMs, PERF.NORMAL);
    });

    it('POST /auth/forgot-password siempre responde 204 sin filtrar si el email existe', async () => {
      const { result: res, durationMs } = await measure(() =>
        request(server)
          .post('/api/v1/auth/forgot-password')
          .send({ email: `no-existe-${Date.now()}@sprig.test` }),
      );
      expect(res.status).toBe(204);
      expectFasterThan(durationMs, PERF.SLOW);
    });

    it('POST /auth/logout sin refresh_token ni cookie no depende de Keycloak (204)', async () => {
      const res = await request(server).post('/api/v1/auth/logout').send({});
      expect(res.status).toBe(204);
    });
  });

  describe('validación de errores', () => {
    it('rechaza POST /auth/login con body inválido (400, ValidationPipe)', async () => {
      const res = await request(server)
        .post('/api/v1/auth/login')
        .send({ username: '', password: '' });
      expect(res.status).toBe(400);
    });

    it('rechaza POST /auth/login con contraseña no encriptada (400, regla de negocio previa a Keycloak)', async () => {
      const res = await request(server).post('/api/v1/auth/login').send({
        username: 'juan_perez',
        password: 'plain-text-password',
      });
      expect(res.status).toBe(400);
    });

    it('rechaza POST /auth/forgot-password con email inválido (400)', async () => {
      const res = await request(server)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'not-an-email' });
      expect(res.status).toBe(400);
    });

    it('rechaza POST /auth/verify-otp con código fuera de formato (400, ValidationPipe)', async () => {
      const res = await request(server)
        .post('/api/v1/auth/verify-otp')
        .send({ email: 'user@example.com', code: 'abc' });
      expect(res.status).toBe(400);
    });

    it('rechaza POST /auth/reset-password con reset_token malformado (400, HMAC local)', async () => {
      const res = await request(server)
        .post('/api/v1/auth/reset-password')
        .send({
          email: 'user@example.com',
          reset_token: 'not-a-valid-token',
          new_password: 'NuevaClave123!!',
        });
      expect(res.status).toBe(400);
    });

    it('rechaza POST /auth/reset-password con contraseña débil (400, ValidationPipe)', async () => {
      const res = await request(server)
        .post('/api/v1/auth/reset-password')
        .send({
          email: 'user@example.com',
          reset_token: 'a.b.c',
          new_password: '123',
        });
      expect(res.status).toBe(400);
    });

    it('rechaza POST /auth/encrypt con body inválido (400)', async () => {
      const res = await request(server)
        .post('/api/v1/auth/encrypt')
        .send({ password: '' });
      expect(res.status).toBe(400);
    });

    it('rechaza POST /auth/introspect sin Authorization header (401, antes de tocar Keycloak)', async () => {
      const res = await request(server).post('/api/v1/auth/introspect');
      expect(res.status).toBe(401);
    });

    it('rechaza POST /auth/change-password sin Authorization header (401, AuthGuard real)', async () => {
      const res = await request(server)
        .post('/api/v1/auth/change-password')
        .send({ currentPassword: 'x', newPassword: 'y' });
      expect(res.status).toBe(401);
    });

    it('rechaza POST /auth/change-password con body inválido (400, antes de Keycloak)', async () => {
      const res = await request(server)
        .post('/api/v1/auth/change-password')
        .set(...authHeader({ userId }))
        .send({ currentPassword: '', newPassword: '' });
      expect(res.status).toBe(400);
    });

    it('rechaza GET /auth/sessions sin Authorization header (401, AuthGuard real)', async () => {
      const res = await request(server).get('/api/v1/auth/sessions');
      expect(res.status).toBe(401);
    });

    it('rechaza DELETE /auth/sessions/:sessionId sin Authorization header (401)', async () => {
      const res = await request(server).delete(
        '/api/v1/auth/sessions/some-session-id',
      );
      expect(res.status).toBe(401);
    });

    it('rechaza GET /auth/access-history sin Authorization header (401)', async () => {
      const res = await request(server).get('/api/v1/auth/access-history');
      expect(res.status).toBe(401);
    });
  });

  describe('rendimiento', () => {
    // `POST /auth/encrypt` tiene `@Throttle({ auth: { limit: 10, ttl: 60_000 } })`
    // fijo en el decorador (no lee `THROTTLE_AUTH_LIMIT`, que sólo relaja el
    // límite global vía `test/utils/env-setup.ts`). Este spec ya consumió 2
    // llamadas previas a este mismo endpoint ("flujo feliz" + "validación de
    // errores"), así que aquí se usan 8 más para no exceder el cupo real de
    // 10 req/min y obtener un 429 inesperado.
    it('8 POSTs consecutivos a /auth/encrypt mantienen latencia estable (sin Keycloak)', async () => {
      const durations: number[] = [];
      for (let i = 0; i < 8; i++) {
        const { durationMs, result: res } = await measure(() =>
          request(server)
            .post('/api/v1/auth/encrypt')
            .send({ password: `Clave-e2e-${i}!` }),
        );
        expect(res.status).toBe(200);
        durations.push(durationMs);
      }
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      expectFasterThan(avg, PERF.NORMAL);
    });
  });
});

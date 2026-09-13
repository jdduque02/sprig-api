import request from 'supertest';
import { App } from 'supertest/types';
import {
  createTestApp,
  closeTestApp,
  TestAppContext,
} from '../../utils/e2e-app.helper';
import { authHeader } from '../../utils/test-auth.helper';
import { measure, expectFasterThan, PERF } from '../../utils/perf.helper';
import { unwrapOne } from '../../utils/response.helper';

describe('AdminLogController (e2e)', () => {
  let ctx: TestAppContext;
  let server: App;

  const userId = 960001;
  const nonAdminUserId = 960002;
  const base = '/api/v1/admin/logs';

  beforeAll(async () => {
    ctx = await createTestApp();
    server = ctx.app.getHttpServer() as App;
  });

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  describe('flujo feliz completo', () => {
    it('lista logs del sistema (GET) dentro del umbral de latencia', async () => {
      const { result: res, durationMs } = await measure(() =>
        request(server)
          .get(base)
          .set(...authHeader({ userId, roles: ['user', 'admin'] })),
      );

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(typeof res.body.total).toBe('number');
      expectFasterThan(durationMs, PERF.NORMAL);
    });

    it('filtra logs por severidad, fuente y paginación', async () => {
      const res = await request(server)
        .get(base)
        .query({ severity: 'ERROR', source: 'app', page: 1, limit: 5 })
        .set(...authHeader({ userId, roles: ['user', 'admin'] }));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeLessThanOrEqual(5);
    });

    it('obtiene estadísticas de logs (GET stats)', async () => {
      const res = await request(server)
        .get(`${base}/stats`)
        .set(...authHeader({ userId, roles: ['user', 'admin'] }));

      expect(res.status).toBe(200);
      const stats = unwrapOne<{
        total: number;
        info: number;
        warn: number;
        error: number;
        debug: number;
      }>(res.body);
      expect(stats).toEqual(
        expect.objectContaining({
          total: expect.any(Number),
          info: expect.any(Number),
          warn: expect.any(Number),
          error: expect.any(Number),
          debug: expect.any(Number),
        }),
      );
    });

    it('obtiene logs en tiempo real (GET realtime)', async () => {
      const res = await request(server)
        .get(`${base}/realtime`)
        .set(...authHeader({ userId, roles: ['user', 'admin'] }));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('validación de errores', () => {
    it('rechaza sin Authorization header (401)', async () => {
      const res = await request(server).get(base);
      expect(res.status).toBe(401);
    });

    it('rechaza token de prueba inválido (401)', async () => {
      const res = await request(server)
        .get(base)
        .set('Authorization', 'Bearer not-a-valid-token');
      expect(res.status).toBe(401);
    });

    it('rechaza acceso sin rol admin (403, AdminGuard real)', async () => {
      const res = await request(server)
        .get(base)
        .set(...authHeader({ userId: nonAdminUserId }));
      expect(res.status).toBe(403);
    });

    it('rechaza severity fuera del enum permitido (400, ValidationPipe)', async () => {
      const res = await request(server)
        .get(base)
        .query({ severity: 'CRITICAL' })
        .set(...authHeader({ userId, roles: ['user', 'admin'] }));
      expect(res.status).toBe(400);
    });

    it('rechaza page menor a 1 (400, Min(1))', async () => {
      const res = await request(server)
        .get(base)
        .query({ page: 0 })
        .set(...authHeader({ userId, roles: ['user', 'admin'] }));
      expect(res.status).toBe(400);
    });

    it('rechaza limit fuera de rango (400, Max(200))', async () => {
      const res = await request(server)
        .get(base)
        .query({ limit: 500 })
        .set(...authHeader({ userId, roles: ['user', 'admin'] }));
      expect(res.status).toBe(400);
    });

    it('rechaza startDate que no es ISO 8601 (400, IsDateString)', async () => {
      const res = await request(server)
        .get(base)
        .query({ startDate: 'not-a-date' })
        .set(...authHeader({ userId, roles: ['user', 'admin'] }));
      expect(res.status).toBe(400);
    });

    it('stats también requiere rol admin (403)', async () => {
      const res = await request(server)
        .get(`${base}/stats`)
        .set(...authHeader({ userId: nonAdminUserId }));
      expect(res.status).toBe(403);
    });
  });

  describe('rendimiento', () => {
    it('10 GETs consecutivos de listado mantienen latencia estable', async () => {
      const durations: number[] = [];
      for (let i = 0; i < 10; i++) {
        const { durationMs, result: res } = await measure(() =>
          request(server)
            .get(base)
            .set(...authHeader({ userId, roles: ['user', 'admin'] })),
        );
        expect(res.status).toBe(200);
        durations.push(durationMs);
      }
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      expectFasterThan(avg, PERF.NORMAL);
    });
  });
});

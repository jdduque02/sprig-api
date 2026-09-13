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

describe('CurrencyController (e2e)', () => {
  let ctx: TestAppContext;
  let server: App;

  const base = '/api/v1/currency';

  beforeAll(async () => {
    ctx = await createTestApp();
    server = ctx.app.getHttpServer() as App;
  });

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  const userId = 920001;

  describe('flujo feliz completo', () => {
    it('consulta la tasa de cambio USD/COP (GET /currency/rates) dentro del umbral de latencia', async () => {
      const { result: res, durationMs } = await measure(() =>
        request(server)
          .get(`${base}/rates`)
          .set(...authHeader({ userId })),
      );

      // Depende de una API externa (open.er-api.com); si la red no está
      // disponible el servicio lanza 500 explícito.
      expect([200, 500]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.data).toBeDefined();
        const rate = unwrapOne<{ cop_per_usd: number; usd_per_cop: number }>(
          res.body,
        );
        expect(typeof rate.cop_per_usd).toBe('number');
        expect(typeof rate.usd_per_cop).toBe('number');
      }
      expectFasterThan(durationMs, PERF.SLOW);
    });
  });

  describe('validación de errores', () => {
    it('rechaza sin Authorization header (401, ahora requiere AuthGuard)', async () => {
      const res = await request(server).get(`${base}/rates`);
      expect(res.status).toBe(401);
    });

    it('rechaza token de prueba inválido (401)', async () => {
      const res = await request(server)
        .get(`${base}/rates`)
        .set('Authorization', 'Bearer not-a-valid-token');
      expect(res.status).toBe(401);
    });
  });

  describe('rendimiento', () => {
    it('8 GETs consecutivos de /currency/rates mantienen latencia estable', async () => {
      const durations: number[] = [];
      for (let i = 0; i < 8; i++) {
        const { durationMs, result: res } = await measure(() =>
          request(server)
            .get(`${base}/rates`)
            .set(...authHeader({ userId })),
        );
        expect([200, 500]).toContain(res.status);
        durations.push(durationMs);
      }
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      expectFasterThan(avg, PERF.SLOW);
    });
  });
});

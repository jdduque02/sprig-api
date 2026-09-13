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

describe('FinancialAssetController (e2e)', () => {
  let ctx: TestAppContext;
  let server: App;

  // financial_asset no tiene FK real a app_user (igual que bank_account).
  const userId = 920001;
  const otherUserId = 920002;
  const base = `/api/v1/users/${userId}/financial-assets`;

  let createdId: number;

  beforeAll(async () => {
    ctx = await createTestApp();
    server = ctx.app.getHttpServer() as App;
  });

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  describe('flujo feliz completo', () => {
    it('crea un activo financiero (POST) dentro del umbral de latencia', async () => {
      const { result: res, durationMs } = await measure(() =>
        request(server)
          .post(base)
          .set(...authHeader({ userId }))
          .send({
            asset_type: 'acciones',
            name: 'Acciones Ecopetrol',
            current_value: 5_000_000,
            current_yield: 11.5,
            currency: 'COP',
            // symbol/quote_source no soportado por CoinGecko: refreshQuotes
            // falla rápido y de forma determinística sin llamada de red real
            // (ver MarketDataService.fetchCoinGecko).
            symbol: 'NOTREAL',
            quote_source: 'coingecko',
          }),
      );

      expect(res.status).toBe(201);
      const created = unwrapOne<{
        id: number;
        name: string;
        asset_type: string;
      }>(res.body);
      expect(created).toMatchObject({
        asset_type: 'acciones',
        name: 'Acciones Ecopetrol',
      });
      createdId = created.id;
      expectFasterThan(durationMs, PERF.NORMAL);
    });

    it('lista los activos financieros del usuario (GET) dentro del umbral de latencia', async () => {
      const { result: res, durationMs } = await measure(() =>
        request(server)
          .get(base)
          .set(...authHeader({ userId })),
      );

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expectFasterThan(durationMs, PERF.NORMAL);
    });

    it('obtiene un activo por id (GET :id)', async () => {
      const res = await request(server)
        .get(`${base}/${createdId}`)
        .set(...authHeader({ userId }));

      expect(res.status).toBe(200);
      expect(unwrapOne<{ id: number }>(res.body).id).toBe(createdId);
    });

    it('consulta cotizaciones en vivo (GET quotes) con símbolo no soportado: éxito=false, sin llamada de red', async () => {
      const { result: res, durationMs } = await measure(() =>
        request(server)
          .get(`${base}/quotes`)
          .set(...authHeader({ userId })),
      );

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      const quote = res.body.data.find(
        (q: { asset_id: number }) => q.asset_id === createdId,
      );
      expect(quote).toMatchObject({ success: false });
      expectFasterThan(durationMs, PERF.NORMAL);
    });

    it('actualiza el activo (PATCH :id)', async () => {
      const res = await request(server)
        .patch(`${base}/${createdId}`)
        .set(...authHeader({ userId }))
        .send({ name: 'Acciones Ecopetrol Renombrado' });

      expect(res.status).toBe(200);
      expect(unwrapOne<{ name: string }>(res.body).name).toBe(
        'Acciones Ecopetrol Renombrado',
      );
    });

    it('elimina el activo (DELETE :id, soft delete) y deja de listarlo', async () => {
      const del = await request(server)
        .delete(`${base}/${createdId}`)
        .set(...authHeader({ userId }));

      expect(del.status).toBe(204);

      const get = await request(server)
        .get(`${base}/${createdId}`)
        .set(...authHeader({ userId }));
      expect(get.status).toBe(404);
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

    it('rechaza acceso a activos de otro usuario (403, OwnershipGuard real)', async () => {
      const res = await request(server)
        .get(base)
        .set(...authHeader({ userId: otherUserId }));
      expect(res.status).toBe(403);
    });

    it('rechaza body inválido en creación (400, ValidationPipe)', async () => {
      const res = await request(server)
        .post(base)
        .set(...authHeader({ userId }))
        .send({ asset_type: '' });
      expect(res.status).toBe(400);
    });

    it('rechaza propiedades no permitidas (400, forbidNonWhitelisted)', async () => {
      const res = await request(server)
        .post(base)
        .set(...authHeader({ userId }))
        .send({
          asset_type: 'acciones',
          name: 'Activo X',
          current_value: 100,
          hacker_field: 'x',
        });
      expect(res.status).toBe(400);
    });

    it('devuelve 404 al buscar un activo inexistente', async () => {
      const res = await request(server)
        .get(`${base}/999999999`)
        .set(...authHeader({ userId }));
      expect(res.status).toBe(404);
    });

    it('devuelve 400 si :id no es numérico (ParseIntPipe)', async () => {
      const res = await request(server)
        .get(`${base}/not-a-number`)
        .set(...authHeader({ userId }));
      expect(res.status).toBe(400);
    });
  });

  describe('rendimiento', () => {
    it('10 GETs consecutivos de listado mantienen latencia estable', async () => {
      const durations: number[] = [];
      for (let i = 0; i < 10; i++) {
        const { durationMs, result: res } = await measure(() =>
          request(server)
            .get(base)
            .set(...authHeader({ userId })),
        );
        expect(res.status).toBe(200);
        durations.push(durationMs);
      }
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      expectFasterThan(avg, PERF.NORMAL);
    });
  });
});

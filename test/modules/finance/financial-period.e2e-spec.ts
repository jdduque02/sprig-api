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

describe('FinancialPeriodController (e2e)', () => {
  let ctx: TestAppContext;
  let server: App;

  const userId = 930007;
  const otherUserId = 930008;
  const base = `/api/v1/users/${userId}/financial-periods`;

  // Año/mes exclusivos de este spec para no chocar con uq_financial_period_user_year_month
  // de otros specs corriendo en paralelo contra la misma BD real. `financial_period` no
  // tiene endpoint de borrado, así que se deriva de Date.now() para no colisionar entre
  // corridas repetidas de este mismo spec durante desarrollo.
  const now = Date.now();
  const year = 2040 + (now % 50);
  const month = (now % 12) + 1;

  let createdId: number;

  beforeAll(async () => {
    ctx = await createTestApp();
    server = ctx.app.getHttpServer() as App;
  });

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  describe('flujo feliz completo', () => {
    it('crea un período financiero (POST) dentro del umbral de latencia', async () => {
      const { result: res, durationMs } = await measure(() =>
        request(server)
          .post(base)
          .set(...authHeader({ userId }))
          .send({ year, month }),
      );

      expect(res.status).toBe(201);
      const created = unwrapOne<{ id: number; year: number; month: number }>(
        res.body,
      );
      expect(created.year).toBe(year);
      expect(created.month).toBe(month);
      createdId = created.id;
      expectFasterThan(durationMs, PERF.NORMAL);
    });

    it('lista los períodos del usuario (GET) dentro del umbral de latencia', async () => {
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

    it('obtiene un período por id (GET :id)', async () => {
      const res = await request(server)
        .get(`${base}/${createdId}`)
        .set(...authHeader({ userId }));

      expect(res.status).toBe(200);
      expect(unwrapOne<{ id: number }>(res.body).id).toBe(createdId);
    });

    it('cierra el período (PATCH :id/close)', async () => {
      const res = await request(server)
        .patch(`${base}/${createdId}/close`)
        .set(...authHeader({ userId }));

      expect(res.status).toBe(200);
      expect(unwrapOne<{ is_closed: boolean }>(res.body).is_closed).toBe(true);
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

    it('rechaza acceso a períodos de otro usuario (403, OwnershipGuard real)', async () => {
      const res = await request(server)
        .get(base)
        .set(...authHeader({ userId: otherUserId }));
      expect(res.status).toBe(403);
    });

    it('rechaza body inválido en creación (400, ValidationPipe: mes fuera de rango)', async () => {
      const res = await request(server)
        .post(base)
        .set(...authHeader({ userId }))
        .send({ year: 2031, month: 13 });
      expect(res.status).toBe(400);
    });

    it('rechaza propiedades no permitidas (400, forbidNonWhitelisted)', async () => {
      const res = await request(server)
        .post(base)
        .set(...authHeader({ userId }))
        .send({ year: 2031, month: 4, hacker_field: 'x' });
      expect(res.status).toBe(400);
    });

    it('rechaza crear un período duplicado (409, ConflictException)', async () => {
      const res = await request(server)
        .post(base)
        .set(...authHeader({ userId }))
        .send({ year, month });
      expect(res.status).toBe(409);
    });

    it('rechaza cerrar un período ya cerrado (409, ConflictException)', async () => {
      const res = await request(server)
        .patch(`${base}/${createdId}/close`)
        .set(...authHeader({ userId }));
      expect(res.status).toBe(409);
    });

    it('devuelve 404 al buscar un período inexistente', async () => {
      const res = await request(server)
        .get(`${base}/999999999`)
        .set(...authHeader({ userId }));
      expect(res.status).toBe(404);
    });

    it('devuelve 404 al cerrar un período inexistente', async () => {
      const res = await request(server)
        .patch(`${base}/999999999/close`)
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

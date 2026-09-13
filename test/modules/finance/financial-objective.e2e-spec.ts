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

describe('FinancialObjectiveController (e2e)', () => {
  let ctx: TestAppContext;
  let server: App;

  const userId = 930005;
  const otherUserId = 930006;
  const base = `/api/v1/users/${userId}/financial-objectives`;

  let createdId: number;

  beforeAll(async () => {
    ctx = await createTestApp();
    server = ctx.app.getHttpServer() as App;
  });

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  describe('flujo feliz completo', () => {
    it('calcula la cuota de ahorro (POST calculate-quota) dentro del umbral de latencia', async () => {
      const { result: res, durationMs } = await measure(() =>
        request(server)
          .post(`${base}/calculate-quota`)
          .set(...authHeader({ userId }))
          .send({
            target_amount: 10_000_000,
            current_balance: 0,
            start_date: '2026-01-01',
            end_date: '2027-12-31',
            frequency: 'monthly',
          }),
      );

      expect(res.status).toBe(200);
      const data = unwrapOne<{ quota_amount: number; total_periods: number }>(
        res.body,
      );
      expect(data.total_periods).toBeGreaterThan(0);
      expect(data.quota_amount).toBeGreaterThan(0);
      expectFasterThan(durationMs, PERF.NORMAL);
    });

    it('crea un objetivo financiero (POST) dentro del umbral de latencia', async () => {
      const { result: res, durationMs } = await measure(() =>
        request(server)
          .post(base)
          .set(...authHeader({ userId }))
          .send({
            name: 'Fondo de emergencia',
            type: 'savings',
            target_amount: 10_000_000,
            current_balance: 0,
          }),
      );

      expect(res.status).toBe(201);
      const created = unwrapOne<{ id: number; name: string }>(res.body);
      expect(created.name).toBe('Fondo de emergencia');
      createdId = created.id;
      expectFasterThan(durationMs, PERF.NORMAL);
    });

    it('lista los objetivos del usuario (GET) dentro del umbral de latencia', async () => {
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

    it('obtiene un objetivo por id (GET :id)', async () => {
      const res = await request(server)
        .get(`${base}/${createdId}`)
        .set(...authHeader({ userId }));

      expect(res.status).toBe(200);
      expect(unwrapOne<{ id: number }>(res.body).id).toBe(createdId);
    });

    it('actualiza el objetivo (PATCH :id)', async () => {
      const res = await request(server)
        .patch(`${base}/${createdId}`)
        .set(...authHeader({ userId }))
        .send({ current_balance: 500000 });

      expect(res.status).toBe(200);
      expect(
        Number(
          unwrapOne<{ current_balance: string }>(res.body).current_balance,
        ),
      ).toBe(500000);
    });

    it('elimina el objetivo (DELETE :id, soft delete) y deja de listarlo', async () => {
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

    it('rechaza acceso a objetivos de otro usuario (403, OwnershipGuard real)', async () => {
      const res = await request(server)
        .get(base)
        .set(...authHeader({ userId: otherUserId }));
      expect(res.status).toBe(403);
    });

    it('rechaza body inválido en creación (400, ValidationPipe: falta name/type)', async () => {
      const res = await request(server)
        .post(base)
        .set(...authHeader({ userId }))
        .send({ target_amount: 1000 });
      expect(res.status).toBe(400);
    });

    it('rechaza propiedades no permitidas (400, forbidNonWhitelisted)', async () => {
      const res = await request(server)
        .post(base)
        .set(...authHeader({ userId }))
        .send({
          name: 'Meta X',
          type: 'savings',
          hacker_field: 'x',
        });
      expect(res.status).toBe(400);
    });

    it('rechaza fechas inválidas en calculate-quota (400, start >= end)', async () => {
      const res = await request(server)
        .post(`${base}/calculate-quota`)
        .set(...authHeader({ userId }))
        .send({
          target_amount: 1_000_000,
          start_date: '2027-01-01',
          end_date: '2026-01-01',
          frequency: 'monthly',
        });
      expect(res.status).toBe(400);
    });

    it('rechaza calculate-quota sin frequency (400, ValidationPipe)', async () => {
      const res = await request(server)
        .post(`${base}/calculate-quota`)
        .set(...authHeader({ userId }))
        .send({ target_amount: 1_000_000, end_date: '2027-01-01' });
      expect(res.status).toBe(400);
    });

    it('devuelve 404 al buscar un objetivo inexistente', async () => {
      const res = await request(server)
        .get(`${base}/999999999`)
        .set(...authHeader({ userId }));
      expect(res.status).toBe(404);
    });

    it('devuelve 404 al actualizar un objetivo inexistente', async () => {
      const res = await request(server)
        .patch(`${base}/999999999`)
        .set(...authHeader({ userId }))
        .send({ current_balance: 1 });
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

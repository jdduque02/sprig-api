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

describe('TransactionRecordController (e2e)', () => {
  let ctx: TestAppContext;
  let server: App;

  // Rango de userId exclusivo de este grupo de specs (finance).
  const userId = 940005;
  const otherUserId = 940006;
  const base = `/api/v1/users/${userId}/transactions`;

  let createdId: number;
  let clonedId: number;

  beforeAll(async () => {
    ctx = await createTestApp();
    server = ctx.app.getHttpServer() as App;
  });

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  describe('flujo feliz completo', () => {
    it('registra una transacción (POST) dentro del umbral de latencia', async () => {
      const { result: res, durationMs } = await measure(() =>
        request(server)
          .post(base)
          .set(...authHeader({ userId }))
          .send({
            type: 'expense',
            amount: 50000,
            description: 'Almuerzo trabajo (e2e)',
            transaction_date: '2026-04-25',
            created_at: '2026-04-25T10:00:00.000Z',
          }),
      );

      expect(res.status).toBe(201);
      const created = unwrapOne<{
        id: number;
        type: string;
        amount: string | number;
      }>(res.body);
      expect(created.type).toBe('expense');
      expect(Number(created.amount)).toBe(50000);
      createdId = Number(created.id);
      expectFasterThan(durationMs, PERF.NORMAL);
    });

    it('lista las transacciones del usuario (GET) filtrando por rango de fechas (partition pruning) dentro del umbral de latencia', async () => {
      const { result: res, durationMs } = await measure(() =>
        request(server)
          .get(base)
          .query({ date_from: '2026-01-01', date_to: '2026-12-31' })
          .set(...authHeader({ userId })),
      );

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(typeof res.body.total).toBe('number');
      expectFasterThan(durationMs, PERF.SLOW);
    });

    it('obtiene una transacción por id (GET :id)', async () => {
      const res = await request(server)
        .get(`${base}/${createdId}`)
        .set(...authHeader({ userId }));

      expect(res.status).toBe(200);
      expect(Number(unwrapOne<{ id: number }>(res.body).id)).toBe(createdId);
    });

    it('obtiene el resumen de transacciones (GET summary) dentro del umbral de latencia (agregado)', async () => {
      const { result: res, durationMs } = await measure(() =>
        request(server)
          .get(`${base}/summary`)
          .query({
            date_from: '2026-01-01',
            date_to: '2026-12-31',
            group_by: 'month',
          })
          .set(...authHeader({ userId })),
      );

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expectFasterThan(durationMs, PERF.SLOW);
    });

    it('lista los próximos pagos de suscripciones (GET upcoming-payments)', async () => {
      const res = await request(server)
        .get(`${base}/upcoming-payments`)
        .set(...authHeader({ userId }));

      expect(res.status).toBe(200);
      const payload = unwrapOne<{ data: unknown[] }>(res.body);
      expect(Array.isArray(payload.data)).toBe(true);
    });

    it('clona la transacción (POST :id/clone)', async () => {
      const res = await request(server)
        .post(`${base}/${createdId}/clone`)
        .set(...authHeader({ userId }))
        .send({ description: 'Clon de almuerzo (e2e)' });

      expect(res.status).toBe(201);
      const cloned = unwrapOne<{ id: number; description: string }>(res.body);
      expect(cloned.description).toBe('Clon de almuerzo (e2e)');
      clonedId = Number(cloned.id);
      expect(clonedId).not.toBe(createdId);
    });

    it('actualiza la transacción (PATCH :id)', async () => {
      const res = await request(server)
        .patch(`${base}/${createdId}`)
        .set(...authHeader({ userId }))
        .send({ description: 'Almuerzo trabajo renombrado' });

      expect(res.status).toBe(200);
      expect(unwrapOne<{ description: string }>(res.body).description).toBe(
        'Almuerzo trabajo renombrado',
      );
    });

    it('elimina en bloque transacciones (DELETE, bulk soft delete)', async () => {
      const res = await request(server)
        .delete(base)
        .set(...authHeader({ userId }))
        .send({ ids: [clonedId] });

      expect(res.status).toBe(200);
      const payload = unwrapOne<{ deleted: number }>(res.body);
      expect(payload.deleted).toBe(1);

      const get = await request(server)
        .get(`${base}/${clonedId}`)
        .set(...authHeader({ userId }));
      expect(get.status).toBe(404);
    });

    it('elimina la transacción (DELETE :id, soft delete) y deja de listarla', async () => {
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

    it('rechaza acceso a transacciones de otro usuario (403, OwnershipGuard real)', async () => {
      const res = await request(server)
        .get(base)
        .set(...authHeader({ userId: otherUserId }));
      expect(res.status).toBe(403);
    });

    it('rechaza body inválido en creación (400, ValidationPipe)', async () => {
      const res = await request(server)
        .post(base)
        .set(...authHeader({ userId }))
        .send({ description: 'sin type ni amount' });
      expect(res.status).toBe(400);
    });

    it('rechaza propiedades no permitidas (400, forbidNonWhitelisted)', async () => {
      const res = await request(server)
        .post(base)
        .set(...authHeader({ userId }))
        .send({
          type: 'expense',
          amount: 1000,
          hacker_field: 'x',
        });
      expect(res.status).toBe(400);
    });

    // HALLAZGO (no corregido, fuera del alcance de "solo tests"): el
    // constraint de clase `SinglePatrimonyConstraint` en
    // `create-transaction-record.dto.ts` se registra vía
    it('rechaza más de un patrimonio asociado (400, SinglePatrimonyConstraint)', async () => {
      const res = await request(server)
        .post(base)
        .set(...authHeader({ userId }))
        .send({
          type: 'expense',
          amount: 1000,
          account_id: 1,
          asset_id: 2,
        });
      expect(res.status).toBe(400);
    });

    it('devuelve 404 al buscar una transacción inexistente', async () => {
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

    it('devuelve 404 al clonar una transacción inexistente', async () => {
      const res = await request(server)
        .post(`${base}/999999999/clone`)
        .set(...authHeader({ userId }))
        .send({});
      expect(res.status).toBe(404);
    });

    it('devuelve 404 al actualizar una transacción inexistente', async () => {
      const res = await request(server)
        .patch(`${base}/999999999`)
        .set(...authHeader({ userId }))
        .send({ description: 'no existe' });
      expect(res.status).toBe(404);
    });

    it('devuelve 404 al eliminar una transacción inexistente', async () => {
      const res = await request(server)
        .delete(`${base}/999999999`)
        .set(...authHeader({ userId }));
      expect(res.status).toBe(404);
    });

    it('rechaza bulk delete con body inválido (400, ArrayMinSize)', async () => {
      const res = await request(server)
        .delete(base)
        .set(...authHeader({ userId }))
        .send({ ids: [] });
      expect(res.status).toBe(400);
    });
  });

  describe('rendimiento', () => {
    it('10 GETs consecutivos de listado (con rango de fechas) mantienen latencia estable', async () => {
      const durations: number[] = [];
      for (let i = 0; i < 10; i++) {
        const { durationMs, result: res } = await measure(() =>
          request(server)
            .get(base)
            .query({ date_from: '2026-01-01', date_to: '2026-12-31' })
            .set(...authHeader({ userId })),
        );
        expect(res.status).toBe(200);
        durations.push(durationMs);
      }
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      expectFasterThan(avg, PERF.SLOW);
    });
  });
});

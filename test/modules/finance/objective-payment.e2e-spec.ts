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

describe('ObjectivePaymentController (e2e)', () => {
  let ctx: TestAppContext;
  let server: App;

  // Rango de userId exclusivo de este grupo de specs (finance).
  const userId = 940001;
  const otherUserId = 940002;
  const objectivesBase = `/api/v1/users/${userId}/financial-objectives`;

  let objectiveId: number;
  let createdPaymentId: number;

  const base = () => `${objectivesBase}/${objectiveId}/payments`;

  beforeAll(async () => {
    ctx = await createTestApp();
    server = ctx.app.getHttpServer() as App;

    const objectiveRes = await request(server)
      .post(objectivesBase)
      .set(...authHeader({ userId }))
      .send({
        name: 'Fondo de emergencia (e2e objective-payment)',
        type: 'savings',
        target_amount: 5_000_000,
      });
    objectiveId = Number(unwrapOne<{ id: number }>(objectiveRes.body).id);
  });

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  describe('flujo feliz completo', () => {
    it('registra un abono (POST) dentro del umbral de latencia', async () => {
      const { result: res, durationMs } = await measure(() =>
        request(server)
          .post(base())
          .set(...authHeader({ userId }))
          .send({
            amount: 200000,
            payment_date: '2026-04-25',
            note: 'Abono mensual',
          }),
      );

      expect(res.status).toBe(201);
      const created = unwrapOne<{
        id: number;
        objective_id: number;
        amount: string | number;
        note: string | null;
      }>(res.body);
      expect(Number(created.amount)).toBe(200000);
      expect(Number(created.objective_id)).toBe(objectiveId);
      expect(created.note).toBe('Abono mensual');
      createdPaymentId = Number(created.id);
      expectFasterThan(durationMs, PERF.NORMAL);
    });

    it('lista los abonos del objetivo (GET) dentro del umbral de latencia', async () => {
      const { result: res, durationMs } = await measure(() =>
        request(server)
          .get(base())
          .set(...authHeader({ userId })),
      );

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expectFasterThan(durationMs, PERF.NORMAL);
    });

    it('obtiene un abono por id (GET :id)', async () => {
      const res = await request(server)
        .get(`${base()}/${createdPaymentId}`)
        .set(...authHeader({ userId }));

      expect(res.status).toBe(200);
      expect(Number(unwrapOne<{ id: number }>(res.body).id)).toBe(
        createdPaymentId,
      );
    });

    it('elimina el abono (DELETE :id, soft delete) y deja de listarlo', async () => {
      const del = await request(server)
        .delete(`${base()}/${createdPaymentId}`)
        .set(...authHeader({ userId }));

      expect(del.status).toBe(204);

      const get = await request(server)
        .get(`${base()}/${createdPaymentId}`)
        .set(...authHeader({ userId }));
      expect(get.status).toBe(404);
    });
  });

  describe('validación de errores', () => {
    it('rechaza sin Authorization header (401)', async () => {
      const res = await request(server).get(base());
      expect(res.status).toBe(401);
    });

    it('rechaza token de prueba inválido (401)', async () => {
      const res = await request(server)
        .get(base())
        .set('Authorization', 'Bearer not-a-valid-token');
      expect(res.status).toBe(401);
    });

    it('rechaza acceso a payments de otro usuario (403, OwnershipGuard real)', async () => {
      const res = await request(server)
        .get(base())
        .set(...authHeader({ userId: otherUserId }));
      expect(res.status).toBe(403);
    });

    it('rechaza body inválido en creación (400, ValidationPipe)', async () => {
      const res = await request(server)
        .post(base())
        .set(...authHeader({ userId }))
        .send({ note: 'sin monto ni fecha' });
      expect(res.status).toBe(400);
    });

    it('rechaza propiedades no permitidas (400, forbidNonWhitelisted)', async () => {
      const res = await request(server)
        .post(base())
        .set(...authHeader({ userId }))
        .send({
          amount: 10000,
          payment_date: '2026-04-25',
          hacker_field: 'x',
        });
      expect(res.status).toBe(400);
    });

    it('devuelve 404 al crear un abono para un objetivo inexistente', async () => {
      const res = await request(server)
        .post(`${objectivesBase}/999999999/payments`)
        .set(...authHeader({ userId }))
        .send({ amount: 1000, payment_date: '2026-04-25' });
      expect(res.status).toBe(404);
    });

    it('devuelve 404 al buscar un abono inexistente', async () => {
      const res = await request(server)
        .get(`${base()}/999999999`)
        .set(...authHeader({ userId }));
      expect(res.status).toBe(404);
    });

    it('devuelve 400 si :id no es numérico (ParseIntPipe)', async () => {
      const res = await request(server)
        .get(`${base()}/not-a-number`)
        .set(...authHeader({ userId }));
      expect(res.status).toBe(400);
    });

    it('devuelve 400 si :objectiveId no es numérico (ParseIntPipe)', async () => {
      const res = await request(server)
        .get(`${objectivesBase}/not-a-number/payments`)
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
            .get(base())
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

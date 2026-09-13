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

describe('CashArqueoController (e2e)', () => {
  let ctx: TestAppContext;
  let server: App;

  const userId = 930001;
  const otherUserId = 930002;
  const base = `/api/v1/users/${userId}/cash-arqueos`;

  // Mes actual (real, no UTC-asumido: el endpoint solo necesita YYYY-MM
  // válido; la lógica de "hoy" del usuario vive en otros módulos).
  const now = new Date();
  const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

  let createdId: number;

  beforeAll(async () => {
    ctx = await createTestApp();
    server = ctx.app.getHttpServer() as App;
  });

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  describe('flujo feliz completo', () => {
    it('obtiene la conciliación del mes (GET reconciliation) dentro del umbral de latencia', async () => {
      const { result: res, durationMs } = await measure(() =>
        request(server)
          .get(`${base}/reconciliation`)
          .query({ month: currentMonth })
          .set(...authHeader({ userId })),
      );

      expect(res.status).toBe(200);
      const data = unwrapOne<{ month: string; expected_amount: number }>(
        res.body,
      );
      expect(data.month).toBe(currentMonth);
      expect(typeof data.expected_amount).toBe('number');
      expectFasterThan(durationMs, PERF.SLOW);
    });

    it('crea un arqueo de caja (POST) dentro del umbral de latencia', async () => {
      const { result: res, durationMs } = await measure(() =>
        request(server)
          .post(base)
          .set(...authHeader({ userId }))
          .send({
            counted_amount: 1500000,
            observations: 'Arqueo de prueba e2e',
          }),
      );

      expect(res.status).toBe(201);
      const created = unwrapOne<{ id: number; counted_amount: string }>(
        res.body,
      );
      // Postgres `numeric` llega como string desde el driver; se compara
      // por valor numérico en vez de por igualdad estricta de tipo.
      expect(Number(created.counted_amount)).toBe(1500000);
      createdId = created.id;
      expectFasterThan(durationMs, PERF.SLOW);
    });

    it('lista los arqueos del usuario (GET) dentro del umbral de latencia', async () => {
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

    it('obtiene un arqueo por id (GET :id)', async () => {
      const res = await request(server)
        .get(`${base}/${createdId}`)
        .set(...authHeader({ userId }));

      expect(res.status).toBe(200);
      expect(unwrapOne<{ id: number }>(res.body).id).toBe(createdId);
    });

    it('elimina el arqueo (DELETE :id, soft delete) y deja de listarlo', async () => {
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

    it('rechaza acceso a cash-arqueos de otro usuario (403, OwnershipGuard real)', async () => {
      const res = await request(server)
        .get(base)
        .set(...authHeader({ userId: otherUserId }));
      expect(res.status).toBe(403);
    });

    it('rechaza body inválido en creación (400, ValidationPipe)', async () => {
      const res = await request(server)
        .post(base)
        .set(...authHeader({ userId }))
        .send({ counted_amount: -100 });
      expect(res.status).toBe(400);
    });

    it('rechaza propiedades no permitidas (400, forbidNonWhitelisted)', async () => {
      const res = await request(server)
        .post(base)
        .set(...authHeader({ userId }))
        .send({ counted_amount: 100, hacker_field: 'x' });
      expect(res.status).toBe(400);
    });

    it('devuelve 404 al buscar un arqueo inexistente', async () => {
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

    it('devuelve 400 si el query month falta en reconciliation', async () => {
      // Antes: `month` era `@Query('month') month: string` sin DTO/regex, y
      // si faltaba `month.split('-')` reventaba con TypeError (500). El
      // controller ahora valida el formato antes de llamar al service.
      const res = await request(server)
        .get(`${base}/reconciliation`)
        .set(...authHeader({ userId }));
      expect(res.status).toBe(400);
    });

    it('devuelve 400 si el query month tiene un formato inválido', async () => {
      const res = await request(server)
        .get(`${base}/reconciliation`)
        .query({ month: 'not-a-month' })
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

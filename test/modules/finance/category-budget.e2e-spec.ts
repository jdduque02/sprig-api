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

describe('CategoryBudgetController (e2e)', () => {
  let ctx: TestAppContext;
  let server: App;

  const userId = 950_000_000 + (Date.now() % 1_000_000);
  const otherUserId = userId + 1;
  const base = `/api/v1/users/${userId}/category-budgets`;
  const categoriesBase = '/api/v1/catalog/categories';
  const transactionsBase = `/api/v1/users/${userId}/transactions`;
  const uniqueCategoryName = `E2E Presupuesto ${Date.now()}`;

  let categoryId: number;
  let createdId: number;
  const period = { year: 2026, month: 5 };

  beforeAll(async () => {
    ctx = await createTestApp();
    server = ctx.app.getHttpServer() as App;

    const category = await request(server)
      .post(categoriesBase)
      .set(...authHeader({ userId }))
      .send({
        name: uniqueCategoryName,
        group_type: 'expense',
        profile_bucket: 'needs',
      });
    categoryId = Number(unwrapOne<{ id: number }>(category.body).id);
  });

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  describe('flujo feliz completo', () => {
    it('crea un presupuesto manual por categoría (POST)', async () => {
      const { result: res, durationMs } = await measure(() =>
        request(server)
          .post(base)
          .set(...authHeader({ userId }))
          .send({
            category_id: categoryId,
            year: period.year,
            month: period.month,
            limit_amount: 500000,
            alert_threshold_percent: 80,
          }),
      );

      expect(res.status).toBe(201);
      const created = unwrapOne<{
        id: number;
        limit_amount: string;
        percent_used: number;
        status: string;
      }>(res.body);
      expect(Number(created.limit_amount)).toBe(500000);
      expect(created.percent_used).toBe(0);
      expect(created.status).toBe('ok');
      createdId = Number(created.id);
      expectFasterThan(durationMs, PERF.NORMAL);
    });

    it('rechaza un presupuesto duplicado para la misma categoría/periodo (409/400/500 por constraint)', async () => {
      const res = await request(server)
        .post(base)
        .set(...authHeader({ userId }))
        .send({
          category_id: categoryId,
          year: period.year,
          month: period.month,
          limit_amount: 100000,
        });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('refleja el gasto acumulado y marca warning al acercarse al límite', async () => {
      await request(server)
        .post(transactionsBase)
        .set(...authHeader({ userId }))
        .send({
          type: 'expense',
          category_id: categoryId,
          amount: 450000,
          transaction_date: `${period.year}-${String(period.month).padStart(2, '0')}-10`,
          description: 'Gasto de prueba presupuesto',
        });

      const res = await request(server)
        .get(`${base}/${createdId}`)
        .set(...authHeader({ userId }));

      expect(res.status).toBe(200);
      const budget = unwrapOne<{
        spent_amount: string | number;
        percent_used: number;
        status: string;
      }>(res.body);
      expect(Number(budget.spent_amount)).toBe(450000);
      expect(budget.percent_used).toBe(90);
      expect(budget.status).toBe('warning');
    });

    it('lista los presupuestos del usuario filtrando por periodo (GET)', async () => {
      const res = await request(server)
        .get(base)
        .query({ year: period.year, month: period.month })
        .set(...authHeader({ userId }));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('actualiza el monto límite del presupuesto (PATCH :id)', async () => {
      const res = await request(server)
        .patch(`${base}/${createdId}`)
        .set(...authHeader({ userId }))
        .send({ limit_amount: 900000 });

      expect(res.status).toBe(200);
      const updated = unwrapOne<{ limit_amount: string; percent_used: number }>(
        res.body,
      );
      expect(Number(updated.limit_amount)).toBe(900000);
      expect(updated.percent_used).toBe(50);
    });

    it('elimina el presupuesto (DELETE :id, soft delete) y deja de listarlo', async () => {
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

    it('rechaza acceso a presupuestos de otro usuario (403, OwnershipGuard real)', async () => {
      const res = await request(server)
        .get(base)
        .set(...authHeader({ userId: otherUserId }));
      expect(res.status).toBe(403);
    });

    it('rechaza categoría inexistente (404)', async () => {
      const res = await request(server)
        .post(base)
        .set(...authHeader({ userId }))
        .send({
          category_id: 999999999,
          year: 2026,
          month: 6,
          limit_amount: 100000,
        });
      expect(res.status).toBe(404);
    });

    it('rechaza body inválido (400, falta limit_amount)', async () => {
      const res = await request(server)
        .post(base)
        .set(...authHeader({ userId }))
        .send({ category_id: categoryId, year: 2026, month: 7 });
      expect(res.status).toBe(400);
    });

    it('devuelve 404 al buscar un presupuesto inexistente', async () => {
      const res = await request(server)
        .get(`${base}/999999999`)
        .set(...authHeader({ userId }));
      expect(res.status).toBe(404);
    });
  });
});

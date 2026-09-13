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

describe('SubcategoryController (e2e)', () => {
  let ctx: TestAppContext;
  let server: App;

  // subcategory tiene FK real (ManyToOne onDelete RESTRICT) a catalog.category
  // -> se crea una categoría padre real vía HTTP antes de las pruebas.
  const userId = 920006;
  const otherUserId = 920007;
  const categoryBase = '/api/v1/catalog/categories';
  const base = `/api/v1/users/${userId}/catalog/subcategories`;

  let categoryId: number;
  let createdId: number;

  beforeAll(async () => {
    ctx = await createTestApp();
    server = ctx.app.getHttpServer() as App;

    const categoryRes = await request(server)
      .post(categoryBase)
      .set(...authHeader({ userId }))
      .send({
        name: `E2E Categoria Padre Subcategoria ${Date.now()}`,
        group_type: 'expense',
      });
    // El id (bigint) puede venir serializado como string o number según el
    // driver de pg; se normaliza a number para las comparaciones del spec.
    categoryId = Number(unwrapOne<{ id: number }>(categoryRes.body).id);
  });

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  describe('flujo feliz completo', () => {
    it('crea una subcategoría (POST) dentro del umbral de latencia', async () => {
      const { result: res, durationMs } = await measure(() =>
        request(server)
          .post(base)
          .set(...authHeader({ userId }))
          .send({
            category_id: categoryId,
            name: 'Restaurantes',
            icon_key: 'silverware',
            color_hex: '#FFA500',
          }),
      );

      expect(res.status).toBe(201);
      const created = unwrapOne<{
        id: number;
        name: string;
        category_id: number;
      }>(res.body);
      expect(created.name).toBe('Restaurantes');
      expect(Number(created.category_id)).toBe(categoryId);
      createdId = Number(created.id);
      expectFasterThan(durationMs, PERF.NORMAL);
    });

    it('lista las subcategorías del usuario (GET) dentro del umbral de latencia', async () => {
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

    it('filtra por categoryId (GET ?categoryId=)', async () => {
      const res = await request(server)
        .get(`${base}?categoryId=${categoryId}`)
        .set(...authHeader({ userId }));

      expect(res.status).toBe(200);
      expect(
        res.body.data.every(
          (s: { category_id: number }) => Number(s.category_id) === categoryId,
        ),
      ).toBe(true);
    });

    it('obtiene una subcategoría por id (GET :id)', async () => {
      const res = await request(server)
        .get(`${base}/${createdId}`)
        .set(...authHeader({ userId }));

      expect(res.status).toBe(200);
      expect(Number(unwrapOne<{ id: number }>(res.body).id)).toBe(createdId);
    });

    it('actualiza la subcategoría (PATCH :id)', async () => {
      const res = await request(server)
        .patch(`${base}/${createdId}`)
        .set(...authHeader({ userId }))
        .send({ name: 'Restaurantes Renombrado' });

      expect(res.status).toBe(200);
      expect(unwrapOne<{ name: string }>(res.body).name).toBe(
        'Restaurantes Renombrado',
      );
    });

    it('desactiva la subcategoría (DELETE :id, soft delete) y deja de encontrarla', async () => {
      const del = await request(server)
        .delete(`${base}/${createdId}`)
        .set(...authHeader({ userId }));

      expect(del.status).toBe(204);

      const get = await request(server)
        .get(`${base}/${createdId}`)
        .set(...authHeader({ userId }));
      // `findById` ahora filtra por `is_active`, igual que `Category`.
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

    it('rechaza acceso a subcategorías de otro usuario (403, OwnershipGuard real)', async () => {
      const res = await request(server)
        .get(base)
        .set(...authHeader({ userId: otherUserId }));
      expect(res.status).toBe(403);
    });

    it('rechaza body inválido en creación (400, ValidationPipe)', async () => {
      const res = await request(server)
        .post(base)
        .set(...authHeader({ userId }))
        .send({ name: '' });
      expect(res.status).toBe(400);
    });

    it('rechaza propiedades no permitidas (400, forbidNonWhitelisted)', async () => {
      const res = await request(server)
        .post(base)
        .set(...authHeader({ userId }))
        .send({
          category_id: categoryId,
          name: 'Subcategoria X',
          hacker_field: 'x',
        });
      expect(res.status).toBe(400);
    });

    it('rechaza nombre duplicado en la misma categoría (409, ConflictException real)', async () => {
      const dupName = `Subcategoria Dup ${Date.now()}`;
      const first = await request(server)
        .post(base)
        .set(...authHeader({ userId }))
        .send({ category_id: categoryId, name: dupName });
      expect(first.status).toBe(201);

      const second = await request(server)
        .post(base)
        .set(...authHeader({ userId }))
        .send({ category_id: categoryId, name: dupName });
      expect(second.status).toBe(409);
    });

    it('devuelve 404 al buscar una subcategoría inexistente', async () => {
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

    // Hallazgo: `SubcategoryRepository.handleDbError` solo mapea violaciones
    // de unicidad (23505) a 409; una FK inexistente (23503) cae al branch
    // genérico y responde 500 en vez de 400/404. No se corrige aquí (fuera
    // de alcance: "no modificar src"), se documenta como hallazgo real.
    it('con category_id inexistente responde 500 (FK violation no mapeada a 400, hallazgo real de la API)', async () => {
      const res = await request(server)
        .post(base)
        .set(...authHeader({ userId }))
        .send({
          category_id: 999999999,
          name: `Subcategoria FK ${Date.now()}`,
        });
      expect(res.status).toBe(500);
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

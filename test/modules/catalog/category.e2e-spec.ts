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

describe('CategoryController (e2e)', () => {
  let ctx: TestAppContext;
  let server: App;

  // category es una tabla global del sistema (sin scope por usuario, sin
  // OwnershipGuard/AdminGuard, solo AuthGuard) — cualquier userId sirve.
  const userId = 920005;
  const base = '/api/v1/catalog/categories';
  // Nombre único por corrida para no chocar con otros specs en paralelo ni
  // con el constraint de unicidad de `name` (ver CategoryRepository).
  const uniqueName = `E2E Categoria ${Date.now()}`;

  let createdId: number;

  beforeAll(async () => {
    ctx = await createTestApp();
    server = ctx.app.getHttpServer() as App;
  });

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  describe('flujo feliz completo', () => {
    it('crea una categoría (POST) dentro del umbral de latencia', async () => {
      const { result: res, durationMs } = await measure(() =>
        request(server)
          .post(base)
          .set(...authHeader({ userId }))
          .send({
            name: uniqueName,
            group_type: 'expense',
            profile_bucket: 'needs',
            icon_key: 'food-fork-drink',
            color_hex: '#FF5733',
          }),
      );

      expect(res.status).toBe(201);
      const created = unwrapOne<{ id: number; name: string }>(res.body);
      expect(created).toMatchObject({
        name: uniqueName,
        group_type: 'expense',
      });
      createdId = created.id;
      expectFasterThan(durationMs, PERF.NORMAL);
    });

    it('lista las categorías activas (GET) dentro del umbral de latencia', async () => {
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

    it('obtiene una categoría por id (GET :id)', async () => {
      const res = await request(server)
        .get(`${base}/${createdId}`)
        .set(...authHeader({ userId }));

      expect(res.status).toBe(200);
      expect(unwrapOne<{ id: number }>(res.body).id).toBe(createdId);
    });

    it('actualiza la categoría (PATCH :id)', async () => {
      const res = await request(server)
        .patch(`${base}/${createdId}`)
        .set(...authHeader({ userId }))
        .send({ icon_key: 'restaurant' });

      expect(res.status).toBe(200);
      expect(unwrapOne<{ icon_key: string }>(res.body).icon_key).toBe(
        'restaurant',
      );
    });

    it('desactiva la categoría (DELETE :id, soft delete) y deja de listarla', async () => {
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

    it('rechaza body inválido en creación (400, ValidationPipe)', async () => {
      const res = await request(server)
        .post(base)
        .set(...authHeader({ userId }))
        .send({ name: '' });
      expect(res.status).toBe(400);
    });

    it('rechaza group_type fuera del enum (400)', async () => {
      const res = await request(server)
        .post(base)
        .set(...authHeader({ userId }))
        .send({ name: 'Categoria invalida', group_type: 'no-existe' });
      expect(res.status).toBe(400);
    });

    it('rechaza propiedades no permitidas (400, forbidNonWhitelisted)', async () => {
      const res = await request(server)
        .post(base)
        .set(...authHeader({ userId }))
        .send({
          name: `E2E Categoria X ${Date.now()}`,
          group_type: 'expense',
          hacker_field: 'x',
        });
      expect(res.status).toBe(400);
    });

    it('rechaza nombre duplicado (409, constraint único real en Category.name)', async () => {
      const dupName = `E2E Categoria Duplicada ${Date.now()}`;
      const first = await request(server)
        .post(base)
        .set(...authHeader({ userId }))
        .send({ name: dupName, group_type: 'expense' });
      expect(first.status).toBe(201);

      const second = await request(server)
        .post(base)
        .set(...authHeader({ userId }))
        .send({ name: dupName, group_type: 'expense' });
      expect(second.status).toBe(409);
    });

    it('devuelve 404 al buscar una categoría inexistente', async () => {
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

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

describe('BankingEntityController (e2e)', () => {
  let ctx: TestAppContext;
  let server: App;

  // Catálogo compartido (no por-usuario): todo el controller vive detrás de
  // AuthGuard + AdminGuard, sin OwnershipGuard.
  const adminUserId = 970007;
  const base = '/api/v1/admin/banking-entities';
  // Código único por corrida para que repetir la suite no choque con el
  // `code` de una corrida anterior (constraint UNIQUE(code) a nivel de tabla,
  // sin índice parcial que excluya soft-deleted).
  const code = `test970007${Date.now()}`;

  let createdId: number;

  beforeAll(async () => {
    ctx = await createTestApp();
    server = ctx.app.getHttpServer() as App;
  });

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  describe('flujo feliz completo', () => {
    it('crea una entidad bancaria (POST, admin) dentro del umbral de latencia', async () => {
      const { result: res, durationMs } = await measure(() =>
        request(server)
          .post(base)
          .set(...authHeader({ userId: adminUserId, roles: ['user', 'admin'] }))
          .send({
            code,
            name: 'Banco de Prueba 970007',
            detect_patterns: ['Movimientos de Prueba 970007'],
          }),
      );

      expect(res.status).toBe(201);
      const created = unwrapOne<{
        id: number;
        code: string;
        is_active: boolean;
      }>(res.body);
      expect(created).toMatchObject({ code, is_active: true });
      createdId = created.id;
      expectFasterThan(durationMs, PERF.NORMAL);
    });

    it('lista todas las entidades (GET, admin) dentro del umbral de latencia', async () => {
      const { result: res, durationMs } = await measure(() =>
        request(server)
          .get(base)
          .set(
            ...authHeader({ userId: adminUserId, roles: ['user', 'admin'] }),
          ),
      );

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(
        res.body.data.some((e: { id: number }) => e.id === createdId),
      ).toBe(true);
      expectFasterThan(durationMs, PERF.NORMAL);
    });

    it('obtiene una entidad por id (GET :id)', async () => {
      const res = await request(server)
        .get(`${base}/${createdId}`)
        .set(...authHeader({ userId: adminUserId, roles: ['user', 'admin'] }));

      expect(res.status).toBe(200);
      expect(unwrapOne<{ id: number }>(res.body).id).toBe(createdId);
    });

    it('actualiza la entidad (PATCH :id)', async () => {
      const res = await request(server)
        .patch(`${base}/${createdId}`)
        .set(...authHeader({ userId: adminUserId, roles: ['user', 'admin'] }))
        .send({ name: 'Banco de Prueba Renombrado 970007' });

      expect(res.status).toBe(200);
      expect(unwrapOne<{ name: string }>(res.body).name).toBe(
        'Banco de Prueba Renombrado 970007',
      );
    });

    it('elimina la entidad (DELETE :id, soft delete) y deja de encontrarla', async () => {
      const del = await request(server)
        .delete(`${base}/${createdId}`)
        .set(...authHeader({ userId: adminUserId, roles: ['user', 'admin'] }));

      expect(del.status).toBe(204);

      const get = await request(server)
        .get(`${base}/${createdId}`)
        .set(...authHeader({ userId: adminUserId, roles: ['user', 'admin'] }));
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

    it('rechaza acceso sin rol admin (403, AdminGuard real)', async () => {
      const res = await request(server)
        .get(base)
        .set(...authHeader({ userId: adminUserId }));
      expect(res.status).toBe(403);
    });

    it('rechaza creación sin rol admin (403)', async () => {
      const res = await request(server)
        .post(base)
        .set(...authHeader({ userId: adminUserId }))
        .send({ code: 'sinpermiso970007', name: 'Sin permisos' });
      expect(res.status).toBe(403);
    });

    it('rechaza body inválido en creación (400, code con mayúsculas)', async () => {
      const res = await request(server)
        .post(base)
        .set(...authHeader({ userId: adminUserId, roles: ['user', 'admin'] }))
        .send({ code: 'CodigoInvalido', name: 'Entidad inválida' });
      expect(res.status).toBe(400);
    });

    it('rechaza propiedades no permitidas (400, forbidNonWhitelisted)', async () => {
      const res = await request(server)
        .post(base)
        .set(...authHeader({ userId: adminUserId, roles: ['user', 'admin'] }))
        .send({
          code: 'otroCodigo970007'.toLowerCase(),
          name: 'Entidad con campo extra',
          hacker_field: 'x',
        });
      expect(res.status).toBe(400);
    });

    it('rechaza código duplicado en creación (409, ConflictException)', async () => {
      const res = await request(server)
        .post(base)
        .set(...authHeader({ userId: adminUserId, roles: ['user', 'admin'] }))
        .send({ code, name: 'Banco Duplicado 970007' });
      expect(res.status).toBe(409);
    });

    it('devuelve 404 al buscar una entidad inexistente', async () => {
      const res = await request(server)
        .get(`${base}/999999999`)
        .set(...authHeader({ userId: adminUserId, roles: ['user', 'admin'] }));
      expect(res.status).toBe(404);
    });

    it('devuelve 400 si :id no es numérico (ParseIntPipe)', async () => {
      const res = await request(server)
        .get(`${base}/not-a-number`)
        .set(...authHeader({ userId: adminUserId, roles: ['user', 'admin'] }));
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
            .set(
              ...authHeader({ userId: adminUserId, roles: ['user', 'admin'] }),
            ),
        );
        expect(res.status).toBe(200);
        durations.push(durationMs);
      }
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      expectFasterThan(avg, PERF.NORMAL);
    });
  });
});

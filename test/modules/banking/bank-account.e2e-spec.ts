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

describe('BankAccountController (e2e)', () => {
  let ctx: TestAppContext;
  let server: App;

  // Usuario de prueba: solo necesita ser un bigint consistente con el
  // header de auth fabricado y con el :userId de la ruta (OwnershipGuard
  // real valida que coincidan). bank_account no tiene FK a app_user.
  const userId = 900001;
  const otherUserId = 900002;
  const base = `/api/v1/users/${userId}/bank-accounts`;

  let createdId: number;

  beforeAll(async () => {
    ctx = await createTestApp();
    server = ctx.app.getHttpServer() as App;
  });

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  describe('flujo feliz completo', () => {
    it('crea una cuenta bancaria (POST) dentro del umbral de latencia', async () => {
      const { result: res, durationMs } = await measure(() =>
        request(server)
          .post(base)
          .set(...authHeader({ userId }))
          .send({
            bank_name: 'Bancolombia',
            account_type: 'ahorros',
            account_number: '1234567890',
            balance: 1_500_000,
            currency: 'COP',
          }),
      );

      expect(res.status).toBe(201);
      const created = unwrapOne<{
        id: number;
        bank_name: string;
        account_type: string;
      }>(res.body);
      expect(created).toMatchObject({
        bank_name: 'Bancolombia',
        account_type: 'ahorros',
      });
      expect(res.body).toEqual(
        expect.objectContaining({
          status: true,
          timestamp: expect.any(String),
        }),
      );
      createdId = created.id;
      expectFasterThan(durationMs, PERF.NORMAL);
    });

    it('lista las cuentas del usuario (GET) dentro del umbral de latencia', async () => {
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

    it('obtiene una cuenta por id (GET :id)', async () => {
      const res = await request(server)
        .get(`${base}/${createdId}`)
        .set(...authHeader({ userId }));

      expect(res.status).toBe(200);
      expect(unwrapOne<{ id: number }>(res.body).id).toBe(createdId);
    });

    it('actualiza la cuenta (PATCH :id)', async () => {
      const res = await request(server)
        .patch(`${base}/${createdId}`)
        .set(...authHeader({ userId }))
        .send({ bank_name: 'Bancolombia Renombrado' });

      expect(res.status).toBe(200);
      expect(unwrapOne<{ bank_name: string }>(res.body).bank_name).toBe(
        'Bancolombia Renombrado',
      );
    });

    it('calcula la proyección de rendimiento (GET :id/projected-yield)', async () => {
      const res = await request(server)
        .get(`${base}/${createdId}/projected-yield`)
        .set(...authHeader({ userId }));

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it('elimina la cuenta (DELETE :id, soft delete) y deja de listarla', async () => {
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
      expect(res.body.error ?? res.body.message).toBeDefined();
    });

    it('rechaza token de prueba inválido (401)', async () => {
      const res = await request(server)
        .get(base)
        .set('Authorization', 'Bearer not-a-valid-token');
      expect(res.status).toBe(401);
    });

    it('rechaza acceso a bank-accounts de otro usuario (403, OwnershipGuard real)', async () => {
      const res = await request(server)
        .get(base)
        .set(...authHeader({ userId: otherUserId }));
      expect(res.status).toBe(403);
    });

    it('rechaza body inválido en creación (400, ValidationPipe)', async () => {
      const res = await request(server)
        .post(base)
        .set(...authHeader({ userId }))
        .send({ bank_name: '' });
      expect(res.status).toBe(400);
    });

    it('rechaza propiedades no permitidas (400, forbidNonWhitelisted)', async () => {
      const res = await request(server)
        .post(base)
        .set(...authHeader({ userId }))
        .send({
          bank_name: 'Nu',
          account_type: 'ahorros',
          account_number: '111',
          balance: 100,
          hacker_field: 'x',
        });
      expect(res.status).toBe(400);
    });

    it('devuelve 404 al buscar una cuenta inexistente', async () => {
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

    it('rechaza ejecutar accrue-interest sin rol admin (403, AdminGuard real)', async () => {
      const res = await request(server)
        .post(`${base}/accrue-interest`)
        .set(...authHeader({ userId }));
      expect(res.status).toBe(403);
    });

    it('permite accrue-interest con rol admin', async () => {
      const res = await request(server)
        .post(`${base}/accrue-interest`)
        .set(...authHeader({ userId, roles: ['user', 'admin'] }));
      expect(res.status).toBe(200);
    });
  });

  describe('rendimiento', () => {
    it('10 GETs consecutivos de listado mantienen latencia estable (sin degradación por rate limit real)', async () => {
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

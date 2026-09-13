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

describe('SupportRequestController (e2e)', () => {
  let ctx: TestAppContext;
  let server: App;

  const userId = 970004;
  const otherUserId = 970005;
  const base = `/api/v1/users/${userId}/support-requests`;

  let createdId: number;

  beforeAll(async () => {
    ctx = await createTestApp();
    server = ctx.app.getHttpServer() as App;
  });

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  describe('flujo feliz completo', () => {
    it('crea una solicitud de soporte (POST) dentro del umbral de latencia', async () => {
      const { result: res, durationMs } = await measure(() =>
        request(server)
          .post(base)
          .set(...authHeader({ userId }))
          .send({
            subject: 'No reconoce el extracto de mi banco 970004',
            description:
              'Al cargar el PDF de mi banco el sistema no detecta ninguna transacción.',
          }),
      );

      expect(res.status).toBe(201);
      const created = unwrapOne<{
        id: number;
        subject: string;
        status: string;
      }>(res.body);
      expect(created).toMatchObject({
        subject: 'No reconoce el extracto de mi banco 970004',
        status: 'open',
      });
      createdId = created.id;
      expectFasterThan(durationMs, PERF.NORMAL);
    });

    it('lista mis solicitudes (GET) dentro del umbral de latencia', async () => {
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

    it('obtiene una solicitud por id (GET :id)', async () => {
      const res = await request(server)
        .get(`${base}/${createdId}`)
        .set(...authHeader({ userId }));

      expect(res.status).toBe(200);
      expect(unwrapOne<{ id: number }>(res.body).id).toBe(createdId);
    });

    it('elimina la solicitud (DELETE :id, soft delete) y deja de encontrarla', async () => {
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

    it('rechaza acceso a solicitudes de otro usuario (403, OwnershipGuard real)', async () => {
      const res = await request(server)
        .get(base)
        .set(...authHeader({ userId: otherUserId }));
      expect(res.status).toBe(403);
    });

    it('rechaza body inválido en creación (400, subject muy corto)', async () => {
      const res = await request(server)
        .post(base)
        .set(...authHeader({ userId }))
        .send({ subject: 'a', description: 'demasiado corto el subject' });
      expect(res.status).toBe(400);
    });

    it('rechaza propiedades no permitidas (400, forbidNonWhitelisted)', async () => {
      const res = await request(server)
        .post(base)
        .set(...authHeader({ userId }))
        .send({
          subject: 'Asunto válido de prueba',
          description:
            'Descripción suficientemente larga para pasar la validación.',
          status: 'resolved',
        });
      expect(res.status).toBe(400);
    });

    it('devuelve 404 al buscar una solicitud inexistente', async () => {
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

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

describe('NotificationController (e2e)', () => {
  let ctx: TestAppContext;
  let server: App;

  // `notification` sí expone un CRUD REST completo (además del gateway
  // WebSocket usado por otros módulos vía RabbitMQ/eventos internos), así
  // que el flujo feliz de "crear/listar" se cubre con el propio endpoint
  // POST del controller en vez de insertar directo por repositorio.
  const userId = 970002;
  const otherUserId = 970003;
  const base = `/api/v1/users/${userId}/notifications`;

  let createdId: number;

  beforeAll(async () => {
    ctx = await createTestApp();
    server = ctx.app.getHttpServer() as App;
  });

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  describe('flujo feliz completo', () => {
    it('crea una notificación (POST) dentro del umbral de latencia', async () => {
      const { result: res, durationMs } = await measure(() =>
        request(server)
          .post(base)
          .set(...authHeader({ userId }))
          .send({
            title: 'Recordatorio de pago 970002',
            description: 'Tu cuota vence en 3 días',
          }),
      );

      expect(res.status).toBe(201);
      const created = unwrapOne<{
        id: number;
        title: string;
        is_read: boolean;
      }>(res.body);
      expect(created).toMatchObject({
        title: 'Recordatorio de pago 970002',
        is_read: false,
      });
      createdId = created.id;
      expectFasterThan(durationMs, PERF.NORMAL);
    });

    it('lista las notificaciones del usuario (GET) dentro del umbral de latencia', async () => {
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

    it('filtra por is_read/is_active (GET ?is_read=false)', async () => {
      const res = await request(server)
        .get(base)
        .query({ is_read: false, is_active: true })
        .set(...authHeader({ userId }));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('obtiene una notificación por id (GET :id)', async () => {
      const res = await request(server)
        .get(`${base}/${createdId}`)
        .set(...authHeader({ userId }));

      expect(res.status).toBe(200);
      expect(unwrapOne<{ id: number }>(res.body).id).toBe(createdId);
    });

    it('actualiza la notificación (PATCH :id)', async () => {
      const res = await request(server)
        .patch(`${base}/${createdId}`)
        .set(...authHeader({ userId }))
        .send({ title: 'Recordatorio actualizado 970002' });

      expect(res.status).toBe(200);
      expect(unwrapOne<{ title: string }>(res.body).title).toBe(
        'Recordatorio actualizado 970002',
      );
    });

    it('marca la notificación como leída (PATCH :id/read)', async () => {
      const res = await request(server)
        .patch(`${base}/${createdId}/read`)
        .set(...authHeader({ userId }));

      expect(res.status).toBe(200);
      expect(unwrapOne<{ is_read: boolean }>(res.body).is_read).toBe(true);
    });

    it('marca todas las notificaciones como leídas (PATCH read-all)', async () => {
      const res = await request(server)
        .patch(`${base}/read-all`)
        .set(...authHeader({ userId }));

      expect(res.status).toBe(200);
    });

    it('elimina la notificación (DELETE :id) y deja de encontrarla', async () => {
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

    it('rechaza acceso a notificaciones de otro usuario (403, OwnershipGuard real)', async () => {
      const res = await request(server)
        .get(base)
        .set(...authHeader({ userId: otherUserId }));
      expect(res.status).toBe(403);
    });

    it('rechaza body inválido en creación (400, falta title)', async () => {
      const res = await request(server)
        .post(base)
        .set(...authHeader({ userId }))
        .send({ description: 'Sin título' });
      expect(res.status).toBe(400);
    });

    it('rechaza propiedades no permitidas (400, forbidNonWhitelisted)', async () => {
      const res = await request(server)
        .post(base)
        .set(...authHeader({ userId }))
        .send({ title: 'Con campo extra', hacker_field: 'x' });
      expect(res.status).toBe(400);
    });

    it('devuelve 404 al buscar una notificación inexistente', async () => {
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

    it('devuelve 403 (no 400) si :userId de la ruta no es numérico, porque OwnershipGuard corre antes que ParseIntPipe', async () => {
      const res = await request(server)
        .get('/api/v1/users/not-a-number/notifications')
        .set(...authHeader({ userId }));
      expect(res.status).toBe(403);
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

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

describe('AdminSupportRequestController (e2e)', () => {
  let ctx: TestAppContext;
  let server: App;

  // `admin/support-requests` no expone POST: la solicitud se crea primero
  // vía el endpoint por-usuario (SupportRequestController, OwnershipGuard),
  // luego se administra desde este controller (AdminGuard).
  const adminUserId = 970006;
  const base = '/api/v1/admin/support-requests';

  let createdId: number;

  beforeAll(async () => {
    ctx = await createTestApp();
    server = ctx.app.getHttpServer() as App;

    const created = await request(server)
      .post(`/api/v1/users/${adminUserId}/support-requests`)
      .set(...authHeader({ userId: adminUserId, roles: ['user', 'admin'] }))
      .send({
        subject: 'Solicitud administrada 970006',
        description:
          'Descripción suficientemente larga para pasar la validación del DTO.',
      });
    createdId = unwrapOne<{ id: number }>(created.body).id;
  });

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  describe('flujo feliz completo', () => {
    it('lista todas las solicitudes (GET, admin) dentro del umbral de latencia', async () => {
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
        res.body.data.some((r: { id: number }) => r.id === createdId),
      ).toBe(true);
      expectFasterThan(durationMs, PERF.NORMAL);
    });

    it('actualiza estado y notas de una solicitud (PATCH :id, admin)', async () => {
      const res = await request(server)
        .patch(`${base}/${createdId}`)
        .set(...authHeader({ userId: adminUserId, roles: ['user', 'admin'] }))
        .send({
          status: 'in_progress',
          admin_notes: 'Escalado a integraciones.',
        });

      expect(res.status).toBe(200);
      expect(
        unwrapOne<{ status: string; admin_notes: string }>(res.body),
      ).toMatchObject({
        status: 'in_progress',
        admin_notes: 'Escalado a integraciones.',
      });
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

    it('rechaza actualización sin rol admin (403)', async () => {
      const res = await request(server)
        .patch(`${base}/${createdId}`)
        .set(...authHeader({ userId: adminUserId }))
        .send({ status: 'closed' });
      expect(res.status).toBe(403);
    });

    it('rechaza status inválido en actualización (400, IsEnum)', async () => {
      const res = await request(server)
        .patch(`${base}/${createdId}`)
        .set(...authHeader({ userId: adminUserId, roles: ['user', 'admin'] }))
        .send({ status: 'not-a-valid-status' });
      expect(res.status).toBe(400);
    });

    it('rechaza propiedades no permitidas (400, forbidNonWhitelisted)', async () => {
      const res = await request(server)
        .patch(`${base}/${createdId}`)
        .set(...authHeader({ userId: adminUserId, roles: ['user', 'admin'] }))
        .send({ hacker_field: 'x' });
      expect(res.status).toBe(400);
    });

    it('devuelve 404 al actualizar una solicitud inexistente', async () => {
      const res = await request(server)
        .patch(`${base}/999999999`)
        .set(...authHeader({ userId: adminUserId, roles: ['user', 'admin'] }))
        .send({ status: 'closed' });
      expect(res.status).toBe(404);
    });

    it('devuelve 400 si :id no es numérico (ParseIntPipe)', async () => {
      const res = await request(server)
        .patch(`${base}/not-a-number`)
        .set(...authHeader({ userId: adminUserId, roles: ['user', 'admin'] }))
        .send({ status: 'closed' });
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

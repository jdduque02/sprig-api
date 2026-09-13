import request from 'supertest';
import { App } from 'supertest/types';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  createTestApp,
  closeTestApp,
  TestAppContext,
} from '../../utils/e2e-app.helper';
import { authHeader } from '../../utils/test-auth.helper';
import { measure, expectFasterThan, PERF } from '../../utils/perf.helper';
import { unwrapOne } from '../../utils/response.helper';
import { AppUser } from '@identity/entities/app-user.entity';

describe('AdminUserController (e2e)', () => {
  let ctx: TestAppContext;
  let server: App;
  let appUserRepo: Repository<AppUser>;

  const adminUserId = 950001;
  const nonAdminUserId = 950002;
  const nonExistentId = 999999999;
  const suffix = Date.now();
  let targetUserId: number;

  beforeAll(async () => {
    ctx = await createTestApp();
    server = ctx.app.getHttpServer() as App;
    appUserRepo = ctx.moduleRef.get<Repository<AppUser>>(
      getRepositoryToken(AppUser),
    );

    // Fila de usuario "objetivo" administrado en las pruebas, sin
    // `external_id` (no hay usuario real en Keycloak, no disponible en este
    // entorno de e2e). Las rutas de escritura de este controller que
    // requieren `external_id` (roles/reset-password/revoke-sessions) validan
    // esa precondición ANTES de llamar a Keycloak y devuelven 400 de forma
    // determinística, por lo que se pueden cubrir sin Keycloak real.
    const created = await appUserRepo.save(
      appUserRepo.create({
        username: `e2e_admin_target_${suffix}`,
        email: `e2e-admin-target-${suffix}@sprig.test`,
        external_id: null as unknown as string,
        roles: ['user'],
        is_active: true,
      }),
    );
    targetUserId = Number(created.id);
  });

  afterAll(async () => {
    if (targetUserId) {
      await appUserRepo.delete({ id: String(targetUserId) });
    }
    await closeTestApp(ctx);
  });

  describe('flujo feliz completo', () => {
    it('GET /admin/users lista usuarios paginados dentro del umbral de latencia', async () => {
      const { result: res, durationMs } = await measure(() =>
        request(server)
          .get('/api/v1/admin/users')
          .query({ page: 1, limit: 20 })
          .set(
            ...authHeader({ userId: adminUserId, roles: ['user', 'admin'] }),
          ),
      );

      expect(res.status).toBe(200);
      const body = res.body as { data: unknown[]; total: number };
      expect(Array.isArray(body.data)).toBe(true);
      expect(typeof body.total).toBe('number');
      expectFasterThan(durationMs, PERF.NORMAL);
    });

    it('GET /admin/users/:id devuelve detalle admin (PII, sesiones vacías sin Keycloak)', async () => {
      const res = await request(server)
        .get(`/api/v1/admin/users/${targetUserId}`)
        .set(...authHeader({ userId: adminUserId, roles: ['user', 'admin'] }));

      expect(res.status).toBe(200);
      const body = unwrapOne<{
        user: { id: string };
        sessions: unknown[];
        accessHistory: unknown[];
      }>(res.body);
      expect(String(body.user.id)).toBe(String(targetUserId));
      expect(body.sessions).toEqual([]);
      expect(body.accessHistory).toEqual([]);
    });

    it('PATCH /admin/users/:id/status activa/desactiva sin depender de Keycloak (external_id null)', async () => {
      const res = await request(server)
        .patch(`/api/v1/admin/users/${targetUserId}/status`)
        .set(...authHeader({ userId: adminUserId, roles: ['user', 'admin'] }))
        .send({ is_active: false });

      expect(res.status).toBe(200);
      const body = unwrapOne<{ is_active: boolean }>(res.body);
      expect(body.is_active).toBe(false);

      // se reactiva para no afectar otras aserciones/limpiezas
      const reactivate = await request(server)
        .patch(`/api/v1/admin/users/${targetUserId}/status`)
        .set(...authHeader({ userId: adminUserId, roles: ['user', 'admin'] }))
        .send({ is_active: true });
      expect(reactivate.status).toBe(200);
    });
  });

  describe('validación de errores', () => {
    it('rechaza GET /admin/users sin Authorization header (401)', async () => {
      const res = await request(server).get('/api/v1/admin/users');
      expect(res.status).toBe(401);
    });

    it('rechaza GET /admin/users con token de prueba inválido (401)', async () => {
      const res = await request(server)
        .get('/api/v1/admin/users')
        .set('Authorization', 'Bearer not-a-valid-token');
      expect(res.status).toBe(401);
    });

    it('rechaza GET /admin/users sin rol admin (403, AdminGuard real)', async () => {
      const res = await request(server)
        .get('/api/v1/admin/users')
        .set(...authHeader({ userId: nonAdminUserId }));
      expect(res.status).toBe(403);
    });

    it('devuelve 404 al buscar el detalle de un usuario inexistente', async () => {
      const res = await request(server)
        .get(`/api/v1/admin/users/${nonExistentId}`)
        .set(...authHeader({ userId: adminUserId, roles: ['user', 'admin'] }));
      expect(res.status).toBe(404);
    });

    it('rechaza PATCH /admin/users/:id/status con body inválido (400, ValidationPipe)', async () => {
      const res = await request(server)
        .patch(`/api/v1/admin/users/${targetUserId}/status`)
        .set(...authHeader({ userId: adminUserId, roles: ['user', 'admin'] }))
        .send({ is_active: 'not-a-boolean' });
      expect(res.status).toBe(400);
    });

    it('rechaza PATCH /admin/users/:id/status sin rol admin (403)', async () => {
      const res = await request(server)
        .patch(`/api/v1/admin/users/${targetUserId}/status`)
        .set(...authHeader({ userId: nonAdminUserId }))
        .send({ is_active: true });
      expect(res.status).toBe(403);
    });

    it('rechaza PATCH /admin/users/:id/roles con rol fuera de la lista permitida (400)', async () => {
      const res = await request(server)
        .patch(`/api/v1/admin/users/${targetUserId}/roles`)
        .set(...authHeader({ userId: adminUserId, roles: ['user', 'admin'] }))
        .send({ roles: ['super-root'] });
      expect(res.status).toBe(400);
    });

    it(
      'devuelve 400 al asignar roles válidos porque la fila objetivo no ' +
        'tiene external_id (KEYCLOAK_ID_MISSING; requiere Keycloak real para el flujo feliz)',
      async () => {
        const res = await request(server)
          .patch(`/api/v1/admin/users/${targetUserId}/roles`)
          .set(...authHeader({ userId: adminUserId, roles: ['user', 'admin'] }))
          .send({ roles: ['admin'] });
        expect(res.status).toBe(400);
      },
    );

    it(
      'devuelve 400 en reset-password porque la fila objetivo no tiene ' +
        'external_id (requiere Keycloak real para el flujo feliz)',
      async () => {
        const res = await request(server)
          .post(`/api/v1/admin/users/${targetUserId}/reset-password`)
          .set(
            ...authHeader({ userId: adminUserId, roles: ['user', 'admin'] }),
          );
        expect(res.status).toBe(400);
      },
    );

    it(
      'devuelve 400 en revoke-all-sessions porque la fila objetivo no tiene ' +
        'external_id (requiere Keycloak real para el flujo feliz)',
      async () => {
        const res = await request(server)
          .delete(`/api/v1/admin/users/${targetUserId}/sessions`)
          .set(
            ...authHeader({ userId: adminUserId, roles: ['user', 'admin'] }),
          );
        expect(res.status).toBe(400);
      },
    );

    it(
      'devuelve 400 en revoke-session porque la fila objetivo no tiene ' +
        'external_id (requiere Keycloak real para el flujo feliz)',
      async () => {
        const res = await request(server)
          .delete(
            `/api/v1/admin/users/${targetUserId}/sessions/fake-session-id`,
          )
          .set(
            ...authHeader({ userId: adminUserId, roles: ['user', 'admin'] }),
          );
        expect(res.status).toBe(400);
      },
    );

    it('rechaza reset-password sin rol admin (403)', async () => {
      const res = await request(server)
        .post(`/api/v1/admin/users/${targetUserId}/reset-password`)
        .set(...authHeader({ userId: nonAdminUserId }));
      expect(res.status).toBe(403);
    });
  });

  describe('rendimiento', () => {
    it('10 GETs consecutivos de listado admin mantienen latencia estable', async () => {
      const durations: number[] = [];
      for (let i = 0; i < 10; i++) {
        const { durationMs, result: res } = await measure(() =>
          request(server)
            .get('/api/v1/admin/users')
            .query({ page: 1, limit: 10 })
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

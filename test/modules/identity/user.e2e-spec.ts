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

describe('UserController (e2e)', () => {
  let ctx: TestAppContext;
  let server: App;
  let appUserRepo: Repository<AppUser>;

  // Rango exclusivo de este grupo de specs (identity/auth/audit): 950001+.
  // `AppUser.id` es GENERATED ALWAYS AS IDENTITY (Postgres) -> no se puede
  // forzar el valor 950001 como PK real; se usa el id autogenerado real como
  // userId del token para las rutas guardadas por OwnershipGuard, y 950001+
  // para los casos que NO requieren fila real (ownership-mismatch, admin).
  const adminUserId = 950001;
  const otherUserId = 950002;
  const nonExistentUserId = 999999999;

  const suffix = Date.now();
  let selfUserId: number;

  beforeAll(async () => {
    ctx = await createTestApp();
    server = ctx.app.getHttpServer() as App;
    appUserRepo = ctx.moduleRef.get<Repository<AppUser>>(
      getRepositoryToken(AppUser),
    );

    // `POST /user` depende de Keycloak real (KeycloakAdminService.createUser)
    // para el flujo feliz, así que se inserta la fila directamente por
    // repositorio (sin external_id) para las rutas guardadas por
    // OwnershipGuard (GET/PATCH /user/:id), que sólo necesitan la fila en
    // `identity.app_user`, no un usuario real de Keycloak.
    const created = await appUserRepo.save(
      appUserRepo.create({
        username: `e2e_user_self_${suffix}`,
        email: `e2e-user-self-${suffix}@sprig.test`,
        external_id: null as unknown as string,
        roles: ['user'],
        is_active: true,
      }),
    );
    selfUserId = Number(created.id);
  });

  afterAll(async () => {
    if (selfUserId) {
      await appUserRepo.delete({ id: String(selfUserId) });
    }
    await closeTestApp(ctx);
  });

  describe('flujo feliz completo', () => {
    it('GET /user/public/status responde sin autenticación', async () => {
      const { result: res, durationMs } = await measure(() =>
        request(server).get('/api/v1/user/public/status'),
      );
      expect(res.status).toBe(200);
      const body = unwrapOne<{ status: string; authentication: string }>(
        res.body,
      );
      expect(body.status).toBe('Identity Module is Running');
      expectFasterThan(durationMs, PERF.FAST);
    });

    it('GET /user (admin) lista usuarios paginados', async () => {
      const { result: res, durationMs } = await measure(() =>
        request(server)
          .get('/api/v1/user')
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

    it('GET /user/:id devuelve el propio usuario (OwnershipGuard real)', async () => {
      const res = await request(server)
        .get(`/api/v1/user/${selfUserId}`)
        .set(...authHeader({ userId: selfUserId }));

      expect(res.status).toBe(200);
      const body = unwrapOne<{ id: string; username: string }>(res.body);
      expect(String(body.id)).toBe(String(selfUserId));
    });

    it('PATCH /user/:id actualiza el propio usuario', async () => {
      const res = await request(server)
        .patch(`/api/v1/user/${selfUserId}`)
        .set(...authHeader({ userId: selfUserId }))
        .send({ timezone: 'America/Bogota', locale: 'es' });

      expect(res.status).toBe(200);
      const body = unwrapOne<{ timezone: string; locale: string }>(res.body);
      expect(body.timezone).toBe('America/Bogota');
      expect(body.locale).toBe('es');
    });
  });

  describe('validación de errores', () => {
    it('rechaza POST /user con body inválido (400, sin llegar a Keycloak)', async () => {
      const res = await request(server)
        .post('/api/v1/user')
        .send({ username: '', email: 'not-an-email' });
      expect(res.status).toBe(400);
    });

    it('rechaza POST /user con password débil (400)', async () => {
      const res = await request(server)
        .post('/api/v1/user')
        .send({
          username: `e2e_weak_${suffix}`,
          email: `e2e-weak-${suffix}@sprig.test`,
          password: '123',
        });
      expect(res.status).toBe(400);
    });

    it('rechaza GET /user sin Authorization header (401)', async () => {
      const res = await request(server).get('/api/v1/user');
      expect(res.status).toBe(401);
    });

    it('rechaza GET /user con token de prueba inválido (401)', async () => {
      const res = await request(server)
        .get('/api/v1/user')
        .set('Authorization', 'Bearer not-a-valid-token');
      expect(res.status).toBe(401);
    });

    it('rechaza GET /user sin rol admin (403, AdminGuard real)', async () => {
      const res = await request(server)
        .get('/api/v1/user')
        .set(...authHeader({ userId: adminUserId }));
      expect(res.status).toBe(403);
    });

    it('rechaza GET /user/:id de otro usuario (403, OwnershipGuard real)', async () => {
      const res = await request(server)
        .get(`/api/v1/user/${selfUserId}`)
        .set(...authHeader({ userId: otherUserId }));
      expect(res.status).toBe(403);
    });

    it('devuelve 404 al buscar un usuario inexistente (ownership del propio id)', async () => {
      const res = await request(server)
        .get(`/api/v1/user/${nonExistentUserId}`)
        .set(...authHeader({ userId: nonExistentUserId }));
      expect(res.status).toBe(404);
    });

    it('rechaza PATCH /user/:id con email inválido (400, ValidationPipe)', async () => {
      const res = await request(server)
        .patch(`/api/v1/user/${selfUserId}`)
        .set(...authHeader({ userId: selfUserId }))
        .send({ email: 'not-an-email' });
      expect(res.status).toBe(400);
    });

    it('rechaza PATCH /user/:id con propiedades no permitidas (400, forbidNonWhitelisted)', async () => {
      const res = await request(server)
        .patch(`/api/v1/user/${selfUserId}`)
        .set(...authHeader({ userId: selfUserId }))
        .send({ hacker_field: 'x' });
      expect(res.status).toBe(400);
    });

    it('rechaza PATCH /user/:id de otro usuario (403, OwnershipGuard real)', async () => {
      const res = await request(server)
        .patch(`/api/v1/user/${selfUserId}`)
        .set(...authHeader({ userId: otherUserId }))
        .send({ timezone: 'America/Bogota' });
      expect(res.status).toBe(403);
    });

    it('devuelve 404 al actualizar un usuario inexistente', async () => {
      const res = await request(server)
        .patch(`/api/v1/user/${nonExistentUserId}`)
        .set(...authHeader({ userId: nonExistentUserId }))
        .send({ timezone: 'America/Bogota' });
      expect(res.status).toBe(404);
    });
  });

  describe('rendimiento', () => {
    it('10 GETs consecutivos de /user (admin) mantienen latencia estable', async () => {
      const durations: number[] = [];
      for (let i = 0; i < 10; i++) {
        const { durationMs, result: res } = await measure(() =>
          request(server)
            .get('/api/v1/user')
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

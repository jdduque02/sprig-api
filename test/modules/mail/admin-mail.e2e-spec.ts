import request from 'supertest';
import { App } from 'supertest/types';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailTemplate } from '@mail/entities/email-template.entity';
import {
  createTestApp,
  closeTestApp,
  TestAppContext,
} from '../../utils/e2e-app.helper';
import { authHeader } from '../../utils/test-auth.helper';
import { measure, expectFasterThan, PERF } from '../../utils/perf.helper';
import { unwrapOne } from '../../utils/response.helper';

/**
 * `MailService.sendBroadcast` guarda la plantilla en `mail.email_template`
 * (key `broadcast_<timestamp>`) y "envía" un correo a cada usuario activo de
 * `identity.app_user` (mockeado si `MAIL_ENABLED=false`, ver `.env.example` —
 * no se cambia ese valor). Se limpian las plantillas creadas por este spec en
 * `afterAll` para no dejar basura en la BD de desarrollo compartida.
 */
describe('AdminMailController (e2e)', () => {
  let ctx: TestAppContext;
  let server: App;
  let templateRepo: Repository<EmailTemplate>;

  const userId = 960007;
  const nonAdminUserId = 960008;
  const base = '/api/v1/admin/emails/broadcast';
  const createdKeys: string[] = [];

  beforeAll(async () => {
    ctx = await createTestApp();
    server = ctx.app.getHttpServer() as App;
    templateRepo = ctx.moduleRef.get<Repository<EmailTemplate>>(
      getRepositoryToken(EmailTemplate),
    );
  });

  afterAll(async () => {
    if (createdKeys.length) {
      await templateRepo.delete(createdKeys);
    }
    await closeTestApp(ctx);
  });

  describe('flujo feliz completo', () => {
    it('crea y envía un broadcast a los usuarios activos (admin) dentro del umbral de latencia', async () => {
      const { result: res, durationMs } = await measure(() =>
        request(server)
          .post(base)
          .set(...authHeader({ userId, roles: ['user', 'admin'] }))
          .send({
            subject: 'Novedades e2e Sprig',
            html_body: '<h1>Hola {{name}}</h1><p>Año {{year}}.</p>',
          }),
      );

      expect(res.status).toBe(200);
      const body = unwrapOne<{
        key: string;
        subject: string;
        recipients: number;
        sent: number;
        failed: number;
      }>(res.body);
      expect(body).toEqual(
        expect.objectContaining({
          key: expect.stringMatching(/^broadcast_\d+$/),
          subject: 'Novedades e2e Sprig',
          recipients: expect.any(Number),
          sent: expect.any(Number),
          failed: expect.any(Number),
        }),
      );
      createdKeys.push(body.key);
      expectFasterThan(durationMs, PERF.SLOW);
    });
  });

  describe('validación de errores', () => {
    it('rechaza sin Authorization header (401)', async () => {
      const res = await request(server)
        .post(base)
        .send({ subject: 'x', html_body: '<p>x</p>' });
      expect(res.status).toBe(401);
    });

    it('rechaza token de prueba inválido (401)', async () => {
      const res = await request(server)
        .post(base)
        .set('Authorization', 'Bearer not-a-valid-token')
        .send({ subject: 'x', html_body: '<p>x</p>' });
      expect(res.status).toBe(401);
    });

    it('rechaza acceso sin rol admin (403, AdminGuard real)', async () => {
      const res = await request(server)
        .post(base)
        .set(...authHeader({ userId: nonAdminUserId }))
        .send({ subject: 'x', html_body: '<p>x</p>' });
      expect(res.status).toBe(403);
    });

    it('rechaza body sin subject (400, ValidationPipe)', async () => {
      const res = await request(server)
        .post(base)
        .set(...authHeader({ userId, roles: ['user', 'admin'] }))
        .send({ html_body: '<p>x</p>' });
      expect(res.status).toBe(400);
    });

    it('rechaza subject vacío (400)', async () => {
      const res = await request(server)
        .post(base)
        .set(...authHeader({ userId, roles: ['user', 'admin'] }))
        .send({ subject: '', html_body: '<p>x</p>' });
      expect(res.status).toBe(400);
    });

    it('rechaza propiedades no permitidas (400, forbidNonWhitelisted)', async () => {
      const res = await request(server)
        .post(base)
        .set(...authHeader({ userId, roles: ['user', 'admin'] }))
        .send({
          subject: 'x',
          html_body: '<p>x</p>',
          hacker_field: 'x',
        });
      expect(res.status).toBe(400);
    });
  });

  describe('rendimiento', () => {
    // El controller solo expone un endpoint de escritura (broadcast), sin
    // listado propio: para no crear 8-10 plantillas/broadcasts reales en la
    // BD de desarrollo compartida, se mide la latencia del guardrail
    // AuthGuard+AdminGuard (rechazo 403) contra el mismo endpoint, que
    // ejercita el pipeline completo de la ruta sin efectos secundarios.
    it('8 rechazos 403 consecutivos mantienen latencia estable (guardas reales, sin side effects)', async () => {
      const durations: number[] = [];
      for (let i = 0; i < 8; i++) {
        const { durationMs, result: res } = await measure(() =>
          request(server)
            .post(base)
            .set(...authHeader({ userId: nonAdminUserId }))
            .send({ subject: 'x', html_body: '<p>x</p>' }),
        );
        expect(res.status).toBe(403);
        durations.push(durationMs);
      }
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      expectFasterThan(avg, PERF.NORMAL);
    });
  });
});

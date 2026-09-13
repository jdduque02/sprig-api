import request from 'supertest';
import { App } from 'supertest/types';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailTemplate } from '@mail/entities/email-template.entity';
import { OTP_EMAIL_TEMPLATE_KEY } from '@mail/service/mail.service';
import {
  createTestApp,
  closeTestApp,
  TestAppContext,
} from '../../utils/e2e-app.helper';
import { authHeader } from '../../utils/test-auth.helper';
import { measure, expectFasterThan, PERF } from '../../utils/perf.helper';
import { unwrapOne } from '../../utils/response.helper';

describe('MailTemplateController (e2e)', () => {
  let ctx: TestAppContext;
  let server: App;
  let templateRepo: Repository<EmailTemplate>;

  const userId = 960009;
  const nonAdminUserId = 960010;
  const base = '/api/v1/email-templates';
  const customKey = 'e2e_test_960009_template';

  beforeAll(async () => {
    ctx = await createTestApp();
    server = ctx.app.getHttpServer() as App;
    templateRepo = ctx.moduleRef.get<Repository<EmailTemplate>>(
      getRepositoryToken(EmailTemplate),
    );
  });

  afterAll(async () => {
    await templateRepo.delete({ key: customKey });
    await closeTestApp(ctx);
  });

  describe('flujo feliz completo', () => {
    it('obtiene la plantilla OTP (por defecto o personalizada si ya existe en esta BD compartida)', async () => {
      const { result: res, durationMs } = await measure(() =>
        request(server)
          .get(`${base}/${OTP_EMAIL_TEMPLATE_KEY}`)
          .set(...authHeader({ userId, roles: ['user', 'admin'] })),
      );

      expect(res.status).toBe(200);
      const template = unwrapOne<{
        key: string;
        subject: string;
        html_body: string;
        is_default?: boolean;
      }>(res.body);
      expect(template.key).toBe(OTP_EMAIL_TEMPLATE_KEY);
      // `is_default: true` solo aparece cuando NO hay fila personalizada en
      // `mail.email_template` (rama `react.email`, ver controller). En esta
      // BD de desarrollo compartida puede que ya exista una plantilla OTP
      // personalizada de otra sesión/dev, en cuyo caso `is_default` es
      // `undefined` — se valida el shape, no el estado exacto de ese dato.
      expect(template.subject).toEqual(expect.any(String));
      expect(template.html_body).toEqual(expect.any(String));
      expectFasterThan(durationMs, PERF.NORMAL);
    });

    it('crea una plantilla personalizada (PUT :key)', async () => {
      const res = await request(server)
        .put(`${base}/${customKey}`)
        .set(...authHeader({ userId, roles: ['user', 'admin'] }))
        .send({
          subject: 'Asunto e2e personalizado',
          html_body: '<p>Tu código es {{otp}}</p>',
        });

      expect(res.status).toBe(200);
      const saved = unwrapOne<{ key: string; subject: string }>(res.body);
      expect(saved).toEqual(
        expect.objectContaining({
          key: customKey,
          subject: 'Asunto e2e personalizado',
        }),
      );
    });

    it('devuelve la plantilla personalizada ya guardada (GET :key)', async () => {
      const res = await request(server)
        .get(`${base}/${customKey}`)
        .set(...authHeader({ userId, roles: ['user', 'admin'] }));

      expect(res.status).toBe(200);
      const template = unwrapOne<{ key: string; subject: string }>(res.body);
      expect(template.subject).toBe('Asunto e2e personalizado');
    });

    it('actualiza la plantilla personalizada existente (PUT :key)', async () => {
      const res = await request(server)
        .put(`${base}/${customKey}`)
        .set(...authHeader({ userId, roles: ['user', 'admin'] }))
        .send({
          subject: 'Asunto e2e actualizado',
          html_body: '<p>Nuevo código {{otp}}</p>',
        });

      expect(res.status).toBe(200);
      expect(unwrapOne<{ subject: string }>(res.body).subject).toBe(
        'Asunto e2e actualizado',
      );
    });

    it('sanea HTML peligroso al guardar (script/event handlers removidos)', async () => {
      const res = await request(server)
        .put(`${base}/${customKey}`)
        .set(...authHeader({ userId, roles: ['user', 'admin'] }))
        .send({
          subject: 'Asunto e2e sanitizado',
          html_body: '<p onclick="alert(1)">hola</p><script>alert(2)</script>',
        });

      expect(res.status).toBe(200);
      const saved = unwrapOne<{ html_body: string }>(res.body);
      expect(saved.html_body).not.toContain('<script>');
      expect(saved.html_body).not.toContain('onclick');
    });
  });

  describe('validación de errores', () => {
    it('rechaza sin Authorization header (401)', async () => {
      const res = await request(server).get(
        `${base}/${OTP_EMAIL_TEMPLATE_KEY}`,
      );
      expect(res.status).toBe(401);
    });

    it('rechaza token de prueba inválido (401)', async () => {
      const res = await request(server)
        .get(`${base}/${OTP_EMAIL_TEMPLATE_KEY}`)
        .set('Authorization', 'Bearer not-a-valid-token');
      expect(res.status).toBe(401);
    });

    it('rechaza acceso sin rol admin en GET (403, AdminGuard real)', async () => {
      const res = await request(server)
        .get(`${base}/${OTP_EMAIL_TEMPLATE_KEY}`)
        .set(...authHeader({ userId: nonAdminUserId }));
      expect(res.status).toBe(403);
    });

    it('rechaza acceso sin rol admin en PUT (403)', async () => {
      const res = await request(server)
        .put(`${base}/${customKey}`)
        .set(...authHeader({ userId: nonAdminUserId }))
        .send({ subject: 'x', html_body: '<p>x</p>' });
      expect(res.status).toBe(403);
    });

    it('devuelve 404 para una key desconocida que no es la plantilla OTP', async () => {
      const res = await request(server)
        .get(`${base}/clave-totalmente-inexistente`)
        .set(...authHeader({ userId, roles: ['user', 'admin'] }));
      expect(res.status).toBe(404);
    });

    it('rechaza PUT sin subject (400, ValidationPipe)', async () => {
      const res = await request(server)
        .put(`${base}/${customKey}`)
        .set(...authHeader({ userId, roles: ['user', 'admin'] }))
        .send({ html_body: '<p>x</p>' });
      expect(res.status).toBe(400);
    });

    it('rechaza PUT con html_body vacío (400, MinLength)', async () => {
      const res = await request(server)
        .put(`${base}/${customKey}`)
        .set(...authHeader({ userId, roles: ['user', 'admin'] }))
        .send({ subject: 'x', html_body: '' });
      expect(res.status).toBe(400);
    });

    it('rechaza propiedades no permitidas (400, forbidNonWhitelisted)', async () => {
      const res = await request(server)
        .put(`${base}/${customKey}`)
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
    it('8 GETs consecutivos de la plantilla OTP por defecto mantienen latencia estable', async () => {
      const durations: number[] = [];
      for (let i = 0; i < 8; i++) {
        const { durationMs, result: res } = await measure(() =>
          request(server)
            .get(`${base}/${OTP_EMAIL_TEMPLATE_KEY}`)
            .set(...authHeader({ userId, roles: ['user', 'admin'] })),
        );
        expect(res.status).toBe(200);
        durations.push(durationMs);
      }
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      expectFasterThan(avg, PERF.NORMAL);
    });
  });
});

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
import { AuditLog } from '@audit/entities/audit-log.entity';
import { AuditActionEnum } from '@shared/enums';

interface AuditListBody {
  data: Array<{ schema_name: string; table_name: string; changed_by: number }>;
  total: number;
}

describe('AuditLogController (e2e)', () => {
  let ctx: TestAppContext;
  let server: App;
  let auditLogRepo: Repository<AuditLog>;

  // Rango exclusivo de este grupo (identity/auth/audit): 950001+.
  // `audit_log` no tiene FK a `app_user` (columna `changed_by` es un bigint
  // libre), así que aquí sí se puede usar el rango de prueba dedicado.
  // El controller completo requiere AdminGuard (dato cross-usuario/cross-
  // tabla, no es self-service): todas las llamadas de flujo feliz usan rol
  // admin; `otherUserId` sin rol admin se usa para probar el 403.
  const userId = 950001;
  const otherUserId = 950002;
  const adminAuth = () => authHeader({ userId, roles: ['user', 'admin'] });
  let seededLogId: number;

  beforeAll(async () => {
    ctx = await createTestApp();
    server = ctx.app.getHttpServer() as App;
    auditLogRepo = ctx.moduleRef.get<Repository<AuditLog>>(
      getRepositoryToken(AuditLog),
    );

    // Se siembra un registro determinístico para los filtros de búsqueda en
    // vez de depender de auditoría generada por otros módulos/specs.
    const seeded = await auditLogRepo.save(
      auditLogRepo.create({
        schema_name: 'identity',
        table_name: 'app_user',
        record_id: userId,
        action: AuditActionEnum.UPDATE,
        old_data: { is_active: true },
        new_data: { is_active: false },
        changed_by: userId,
      }),
    );
    seededLogId = Number(seeded.id);
  });

  afterAll(async () => {
    if (seededLogId) {
      await auditLogRepo.delete({ id: seededLogId });
    }
    await closeTestApp(ctx);
  });

  describe('flujo feliz completo', () => {
    it('GET /audit lista logs con filtros dentro del umbral de latencia', async () => {
      const { result: res, durationMs } = await measure(() =>
        request(server)
          .get('/api/v1/audit')
          .query({
            schema_name: 'identity',
            table_name: 'app_user',
            changed_by: userId,
          })
          .set(...adminAuth()),
      );

      expect(res.status).toBe(200);
      const body = res.body as AuditListBody;
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);
      expect(typeof body.total).toBe('number');
      expect(body.data.every((l) => l.schema_name === 'identity')).toBe(true);
      expectFasterThan(durationMs, PERF.NORMAL);
    });

    it('GET /audit/user/:userId lista logs de un usuario específico', async () => {
      const res = await request(server)
        .get(`/api/v1/audit/user/${userId}`)
        .set(...adminAuth());

      expect(res.status).toBe(200);
      const body = res.body as AuditListBody;
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.every((l) => Number(l.changed_by) === userId)).toBe(
        true,
      );
    });

    it('GET /audit filtra por action (enum)', async () => {
      const res = await request(server)
        .get('/api/v1/audit')
        .query({ action: AuditActionEnum.UPDATE, changed_by: userId })
        .set(...adminAuth());

      expect(res.status).toBe(200);
      const body = res.body as AuditListBody;
      expect(Array.isArray(body.data)).toBe(true);
    });
  });

  describe('validación de errores', () => {
    it('rechaza GET /audit sin Authorization header (401)', async () => {
      const res = await request(server).get('/api/v1/audit');
      expect(res.status).toBe(401);
    });

    it('rechaza GET /audit con token de prueba inválido (401)', async () => {
      const res = await request(server)
        .get('/api/v1/audit')
        .set('Authorization', 'Bearer not-a-valid-token');
      expect(res.status).toBe(401);
    });

    it('rechaza GET /audit con action fuera del enum (400)', async () => {
      const res = await request(server)
        .get('/api/v1/audit')
        .query({ action: 'DROP_TABLE' })
        .set(...adminAuth());
      expect(res.status).toBe(400);
    });

    it('rechaza GET /audit con page inválido (400)', async () => {
      const res = await request(server)
        .get('/api/v1/audit')
        .query({ page: -1 })
        .set(...adminAuth());
      expect(res.status).toBe(400);
    });

    it('rechaza GET /audit con record_id no numérico (400)', async () => {
      const res = await request(server)
        .get('/api/v1/audit')
        .query({ record_id: 'not-a-number' })
        .set(...adminAuth());
      expect(res.status).toBe(400);
    });

    it('rechaza GET /audit/user/:userId con userId no numérico (400, ParseIntPipe)', async () => {
      const res = await request(server)
        .get('/api/v1/audit/user/not-a-number')
        .set(...adminAuth());
      expect(res.status).toBe(400);
    });

    it('devuelve 200 vacío para un userId de auditoría sin registros', async () => {
      const res = await request(server)
        .get('/api/v1/audit/user/999999999')
        .set(...adminAuth());
      expect(res.status).toBe(200);
      expect((res.body as AuditListBody).data).toEqual([]);
    });

    it('rechaza GET /audit/user/:userId sin rol admin (403, AdminGuard real)', async () => {
      const res = await request(server)
        .get(`/api/v1/audit/user/${userId}`)
        .set(...authHeader({ userId: otherUserId }));
      expect(res.status).toBe(403);
    });

    it('rechaza GET /audit sin rol admin (403, AdminGuard real)', async () => {
      const res = await request(server)
        .get('/api/v1/audit')
        .set(...authHeader({ userId: otherUserId }));
      expect(res.status).toBe(403);
    });

    it('permite a un admin leer la auditoría de otro usuario', async () => {
      const res = await request(server)
        .get(`/api/v1/audit/user/${userId}`)
        .set(...authHeader({ userId: otherUserId, roles: ['user', 'admin'] }));
      expect(res.status).toBe(200);
    });
  });

  describe('rendimiento', () => {
    it('10 GETs consecutivos de listado mantienen latencia estable', async () => {
      const durations: number[] = [];
      for (let i = 0; i < 10; i++) {
        const { durationMs, result: res } = await measure(() =>
          request(server)
            .get('/api/v1/audit')
            .query({ changed_by: userId })
            .set(...adminAuth()),
        );
        expect(res.status).toBe(200);
        durations.push(durationMs);
      }
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      expectFasterThan(avg, PERF.NORMAL);
    });
  });
});

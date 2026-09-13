import request from 'supertest';
import { App } from 'supertest/types';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaxSummary } from '@intelligence/entities/tax-summary.entity';
import {
  createTestApp,
  closeTestApp,
  TestAppContext,
} from '../../utils/e2e-app.helper';
import { authHeader } from '../../utils/test-auth.helper';
import { measure, expectFasterThan, PERF } from '../../utils/perf.helper';
import { unwrapOne } from '../../utils/response.helper';

/**
 * `ai-analysis` (narrativa determinística, sin SDK/red — ver
 * `FinancialAiAnalysisService`/`RuleBasedFinancialNarrativeProvider`) y
 * `report` (PDF, mockeado vía `moduleNameMapper` de `@react-pdf/renderer`)
 * requieren un `FinancialSummary` calculado, que a su vez requiere un
 * `identity.financial_profile` — y esa tabla tiene FK real a
 * `identity.app_user(id)` (ver schema.sql). Los usuarios de prueba de este
 * grupo (960001+) no existen en `app_user`, y crear esa fila está fuera del
 * alcance de un fixture de e2e ligero (flujo de alta de usuario vía
 * Keycloak). Por eso solo se cubre el camino de error (404 "perfil
 * financiero requerido") para esos dos endpoints — documentado también en el
 * resumen final de la tarea.
 */
describe('IntelligenceController (e2e)', () => {
  let ctx: TestAppContext;
  let server: App;
  let taxSummaryRepo: Repository<TaxSummary>;

  const userId = 960005;
  const otherUserId = 960006;
  const base = `/api/v1/users/${userId}/intelligence`;

  // Año fiscal fuera de rango real para no colisionar con datos existentes
  // de otras corridas/fixtures en la BD de desarrollo compartida.
  const fiscalYear = 2091;
  const emptyFiscalYear = 1901;
  let createdTaxSummaryId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    server = ctx.app.getHttpServer() as App;
    taxSummaryRepo = ctx.moduleRef.get<Repository<TaxSummary>>(
      getRepositoryToken(TaxSummary),
    );
    // `tax_summary` no tiene borrado lógico (no hay `deleted_at`, ver
    // entidad) y el `Unique` compuesto (user_id, fiscal_year) haría fallar
    // el POST de "flujo feliz" si quedó basura de una corrida anterior de
    // este mismo spec contra la BD de desarrollo compartida.
    await taxSummaryRepo.delete({ user_id: userId });
  });

  afterAll(async () => {
    await taxSummaryRepo.delete({ user_id: userId });
    await closeTestApp(ctx);
  });

  describe('flujo feliz completo (tax-summary, no requiere fixtures previos)', () => {
    it('calcula y persiste el resumen fiscal (POST tax-summary/calculate) dentro del umbral de latencia', async () => {
      const { result: res, durationMs } = await measure(() =>
        request(server)
          .post(`${base}/tax-summary/calculate`)
          .query({ year: fiscalYear })
          .set(...authHeader({ userId })),
      );

      expect(res.status).toBe(201);
      // `id`/`user_id` son `bigint` en Postgres: pg/TypeORM los devuelve
      // como string. Los `numeric` (total_income, uvt_value...) también
      // llegan como string salvo columnas explícitamente mapeadas a number
      // en el DTO/entidad (aquí no lo están).
      const created = unwrapOne<{
        id: string;
        fiscal_year: number;
        uvt_value: number;
        must_declare: boolean;
        validation: { is_valid: boolean; warnings: string[] };
        calculation_details: Record<string, unknown>;
      }>(res.body);
      expect(created).toEqual(
        expect.objectContaining({
          id: expect.anything(),
          fiscal_year: fiscalYear,
          uvt_value: expect.any(Number),
          must_declare: expect.any(Boolean),
          validation: expect.objectContaining({
            is_valid: expect.any(Boolean),
            warnings: expect.any(Array),
          }),
          calculation_details: expect.any(Object),
        }),
      );
      createdTaxSummaryId = created.id;
      expect(createdTaxSummaryId).toBeDefined();
      expectFasterThan(durationMs, PERF.NORMAL);
    });

    it('obtiene el resumen fiscal por año (GET tax-summary?year=)', async () => {
      const res = await request(server)
        .get(`${base}/tax-summary`)
        .query({ year: fiscalYear })
        .set(...authHeader({ userId }));

      expect(res.status).toBe(200);
      expect(String(unwrapOne<{ id: unknown }>(res.body).id)).toBe(
        String(createdTaxSummaryId),
      );
    });

    it('actualiza el resumen fiscal (PUT tax-summary/:id) y recalcula must_declare', async () => {
      const res = await request(server)
        .put(`${base}/tax-summary/${createdTaxSummaryId}`)
        .set(...authHeader({ userId }))
        .send({ total_income: 900_000_000 });

      expect(res.status).toBe(200);
      const updated = unwrapOne<{
        total_income: number;
        must_declare: boolean;
      }>(res.body);
      expect(Number(updated.total_income)).toBe(900_000_000);
      // 900,000,000 / 42,680 (UVT) ~= 21,082 UVT, muy por encima del umbral
      // de declaración de renta (1400 UVT, DIAN) usado por el servicio.
      expect(updated.must_declare).toBe(true);
    });
  });

  describe('validación de errores', () => {
    it('rechaza sin Authorization header (401)', async () => {
      const res = await request(server).get(`${base}/financial-summary`);
      expect(res.status).toBe(401);
    });

    it('rechaza token de prueba inválido (401)', async () => {
      const res = await request(server)
        .get(`${base}/financial-summary`)
        .set('Authorization', 'Bearer not-a-valid-token');
      expect(res.status).toBe(401);
    });

    it('rechaza acceso a la inteligencia de otro usuario (403, OwnershipGuard real)', async () => {
      const res = await request(server)
        .get(`${base}/financial-summary`)
        .set(...authHeader({ userId: otherUserId }));
      expect(res.status).toBe(403);
    });

    it('rechaza :userId no numérico en la ruta (403, OwnershipGuard corre antes que el pipe)', async () => {
      const res = await request(server)
        .get('/api/v1/users/not-a-number/intelligence/financial-summary')
        .set(...authHeader({ userId }));
      expect(res.status).toBe(403);
    });

    it('devuelve 404 al pedir financial-summary sin resumen calculado', async () => {
      const res = await request(server)
        .get(`${base}/financial-summary`)
        .set(...authHeader({ userId }));
      expect(res.status).toBe(404);
    });

    it('devuelve 404 al pedir financial-summary de un período inexistente', async () => {
      const res = await request(server)
        .get(`${base}/financial-summary/period/999999999`)
        .set(...authHeader({ userId }));
      expect(res.status).toBe(404);
    });

    it('devuelve 400 si :periodId no es numérico (ParseIntPipe)', async () => {
      const res = await request(server)
        .get(`${base}/financial-summary/period/not-a-number`)
        .set(...authHeader({ userId }));
      expect(res.status).toBe(400);
    });

    it('devuelve 404 al pedir tax-summary de un año sin datos', async () => {
      const res = await request(server)
        .get(`${base}/tax-summary`)
        .query({ year: emptyFiscalYear })
        .set(...authHeader({ userId }));
      expect(res.status).toBe(404);
    });

    it('devuelve 409 al recalcular tax-summary de un año ya calculado (ConflictException)', async () => {
      const res = await request(server)
        .post(`${base}/tax-summary/calculate`)
        .query({ year: fiscalYear })
        .set(...authHeader({ userId }));
      expect(res.status).toBe(409);
    });

    it('devuelve 404 al actualizar un tax-summary inexistente', async () => {
      const res = await request(server)
        .put(`${base}/tax-summary/999999999`)
        .set(...authHeader({ userId }))
        .send({ total_income: 1000000 });
      expect(res.status).toBe(404);
    });

    it('devuelve 400 si :id no es numérico en tax-summary (ParseIntPipe)', async () => {
      const res = await request(server)
        .put(`${base}/tax-summary/not-a-number`)
        .set(...authHeader({ userId }))
        .send({ total_income: 1000000 });
      expect(res.status).toBe(400);
    });

    it('rechaza total_income negativo al actualizar tax-summary (400, Min(0))', async () => {
      const res = await request(server)
        .put(`${base}/tax-summary/${createdTaxSummaryId}`)
        .set(...authHeader({ userId }))
        .send({ total_income: -1 });
      expect(res.status).toBe(400);
    });

    it('devuelve 404 en ai-analysis sin perfil financiero previo (ver nota de fixtures arriba)', async () => {
      const res = await request(server)
        .get(`${base}/ai-analysis`)
        .set(...authHeader({ userId }));
      expect(res.status).toBe(404);
    });

    it('devuelve 400 en ai-analysis con periodId no numérico', async () => {
      const res = await request(server)
        .get(`${base}/ai-analysis`)
        .query({ periodId: 'not-a-number' })
        .set(...authHeader({ userId }));
      expect(res.status).toBe(400);
    });

    it('devuelve 404 en report (PDF) sin perfil financiero previo', async () => {
      const res = await request(server)
        .get(`${base}/report`)
        .set(...authHeader({ userId }));
      expect(res.status).toBe(404);
    });

    it('devuelve 400 en report con periodId no numérico', async () => {
      const res = await request(server)
        .get(`${base}/report`)
        .query({ periodId: 'not-a-number' })
        .set(...authHeader({ userId }));
      expect(res.status).toBe(400);
    });
  });

  describe('rendimiento', () => {
    it('8 GETs consecutivos de tax-summary mantienen latencia estable', async () => {
      const durations: number[] = [];
      for (let i = 0; i < 8; i++) {
        const { durationMs, result: res } = await measure(() =>
          request(server)
            .get(`${base}/tax-summary`)
            .query({ year: fiscalYear })
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

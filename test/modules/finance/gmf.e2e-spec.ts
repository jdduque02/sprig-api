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

describe('GmfController (e2e)', () => {
  let ctx: TestAppContext;
  let server: App;

  // userId único por corrida para no acumular transacciones/cuentas entre
  // ejecuciones (bank_account/transaction_record no se limpian entre runs).
  const userId = 940_000_000 + (Date.now() % 1_000_000);
  const otherUserId = userId + 1;
  const accountsBase = `/api/v1/users/${userId}/bank-accounts`;
  const transactionsBase = `/api/v1/users/${userId}/transactions`;
  const gmfBase = `/api/v1/users/${userId}/gmf`;

  let nonExemptAccountId: number;
  let exemptAccountId: number;

  beforeAll(async () => {
    ctx = await createTestApp();
    server = ctx.app.getHttpServer() as App;

    const nonExempt = await request(server)
      .post(accountsBase)
      .set(...authHeader({ userId }))
      .send({
        bank_name: 'Bancolombia',
        account_type: 'ahorros',
        account_number: '1111111111',
        balance: 5_000_000,
        currency: 'COP',
        exempt_4x1000: false,
      });
    // `id` viaja como string en el JSON (bigint), se normaliza a number.
    nonExemptAccountId = Number(unwrapOne<{ id: number }>(nonExempt.body).id);

    const exempt = await request(server)
      .post(accountsBase)
      .set(...authHeader({ userId }))
      .send({
        bank_name: 'Nequi',
        account_type: 'ahorros',
        account_number: '2222222222',
        balance: 5_000_000,
        currency: 'COP',
        exempt_4x1000: true,
      });
    exemptAccountId = Number(unwrapOne<{ id: number }>(exempt.body).id);

    // Débito en cuenta NO exenta dentro del periodo de la prueba.
    await request(server)
      .post(transactionsBase)
      .set(...authHeader({ userId }))
      .send({
        type: 'expense',
        amount: 1_000_000,
        account_id: nonExemptAccountId,
        transaction_date: '2026-03-15',
        description: 'Pago arriendo',
      });

    // Débito en cuenta exenta: no debe generar GMF.
    await request(server)
      .post(transactionsBase)
      .set(...authHeader({ userId }))
      .send({
        type: 'expense',
        amount: 500_000,
        account_id: exemptAccountId,
        transaction_date: '2026-03-16',
        description: 'Compra mercado',
      });
  });

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  describe('flujo feliz completo', () => {
    it('calcula el GMF (4x1000) solo sobre la cuenta no exenta', async () => {
      const { result: res, durationMs } = await measure(() =>
        request(server)
          .get(`${gmfBase}/summary`)
          .query({ date_from: '2026-03-01', date_to: '2026-03-31' })
          .set(...authHeader({ userId })),
      );

      expect(res.status).toBe(200);
      const summary = unwrapOne<{
        total_debited_amount: number;
        total_gmf_paid: number;
        estimated_savings_if_exempt: number;
        gmf_rate: number;
        by_account: {
          account_id: number;
          exempt_4x1000: boolean;
          gmf_paid: number;
        }[];
      }>(res.body);

      expect(summary.gmf_rate).toBe(0.004);
      // Total debitado incluye ambas cuentas (exenta y no exenta); el GMF
      // solo se cobra sobre la cuenta no exenta.
      expect(summary.total_debited_amount).toBe(1_500_000);
      expect(summary.total_gmf_paid).toBe(4000);
      expect(summary.estimated_savings_if_exempt).toBe(4000);

      expect(summary.by_account.length).toBe(2);
      const nonExemptRow = summary.by_account.find(
        (a) => a.account_id === nonExemptAccountId,
      );
      const exemptRow = summary.by_account.find(
        (a) => a.account_id === exemptAccountId,
      );
      expect(nonExemptRow?.gmf_paid).toBe(4000);
      expect(exemptRow?.exempt_4x1000).toBe(true);
      expect(exemptRow?.gmf_paid).toBe(0);
      expectFasterThan(durationMs, PERF.NORMAL);
    });

    it('retorna totales en cero fuera del periodo con movimientos', async () => {
      const res = await request(server)
        .get(`${gmfBase}/summary`)
        .query({ date_from: '2020-01-01', date_to: '2020-01-31' })
        .set(...authHeader({ userId }));

      expect(res.status).toBe(200);
      const summary = unwrapOne<{ total_gmf_paid: number }>(res.body);
      expect(summary.total_gmf_paid).toBe(0);
    });
  });

  describe('validación de errores', () => {
    it('rechaza sin Authorization header (401)', async () => {
      const res = await request(server).get(`${gmfBase}/summary`).query({
        date_from: '2026-03-01',
        date_to: '2026-03-31',
      });
      expect(res.status).toBe(401);
    });

    it('rechaza acceso al resumen de otro usuario (403, OwnershipGuard real)', async () => {
      const res = await request(server)
        .get(`${gmfBase}/summary`)
        .query({ date_from: '2026-03-01', date_to: '2026-03-31' })
        .set(...authHeader({ userId: otherUserId }));
      expect(res.status).toBe(403);
    });

    it('rechaza fechas faltantes (400, ValidationPipe)', async () => {
      const res = await request(server)
        .get(`${gmfBase}/summary`)
        .set(...authHeader({ userId }));
      expect(res.status).toBe(400);
    });
  });
});

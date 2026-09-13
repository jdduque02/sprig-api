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

describe('TransferController (e2e)', () => {
  let ctx: TestAppContext;
  let server: App;

  // Rango de userId exclusivo de este grupo de specs (finance).
  const userId = 940007;
  const otherUserId = 940008;
  const bankAccountsBase = `/api/v1/users/${userId}/bank-accounts`;
  const base = `/api/v1/users/${userId}/transfers`;

  let sourceAccountId: number;
  let destinationAccountId: number;
  let createdTransferGroupId: string;
  let clonedTransferGroupId: string;

  async function createBankAccount(bankName: string, balance: number) {
    const res = await request(server)
      .post(bankAccountsBase)
      .set(...authHeader({ userId }))
      .send({
        bank_name: bankName,
        account_type: 'ahorros',
        account_number: `9400${Math.floor(Math.random() * 1_000_000)}`,
        balance,
        currency: 'COP',
      });
    return Number(unwrapOne<{ id: number }>(res.body).id);
  }

  beforeAll(async () => {
    ctx = await createTestApp();
    server = ctx.app.getHttpServer() as App;

    sourceAccountId = await createBankAccount('Bancolombia', 2_000_000);
    destinationAccountId = await createBankAccount('Davivienda', 500_000);
  });

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  describe('flujo feliz completo', () => {
    it('registra un movimiento bancario (POST) dentro del umbral de latencia', async () => {
      const { result: res, durationMs } = await measure(() =>
        request(server)
          .post(base)
          .set(...authHeader({ userId }))
          .send({
            source_account_id: sourceAccountId,
            destination_account_id: destinationAccountId,
            amount: 250000,
            transaction_date: '2026-08-07',
            description: 'Transferencia a cuenta de ahorros (e2e)',
          }),
      );

      expect(res.status).toBe(201);
      const created = unwrapOne<{
        transfer_group_id: string;
        amount: string | number;
        source: { account_id: number };
        destination: { account_id: number };
      }>(res.body);
      expect(Number(created.amount)).toBe(250000);
      expect(Number(created.source.account_id)).toBe(sourceAccountId);
      expect(Number(created.destination.account_id)).toBe(destinationAccountId);
      createdTransferGroupId = created.transfer_group_id;
      expectFasterThan(durationMs, PERF.NORMAL);
    });

    it('lista los movimientos bancarios (GET) dentro del umbral de latencia', async () => {
      const { result: res, durationMs } = await measure(() =>
        request(server)
          .get(base)
          .set(...authHeader({ userId })),
      );

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(typeof res.body.total).toBe('number');
      expectFasterThan(durationMs, PERF.NORMAL);
    });

    it('obtiene una transferencia por id (GET :id, devuelve el par)', async () => {
      const list = await request(server)
        .get(base)
        .set(...authHeader({ userId }));
      const found = (
        list.body.data as {
          transfer_group_id: string;
          source: { id: number };
        }[]
      ).find((t) => t.transfer_group_id === createdTransferGroupId);
      expect(found).toBeDefined();

      const res = await request(server)
        .get(`${base}/${found!.source.id}`)
        .set(...authHeader({ userId }));

      expect(res.status).toBe(200);
      expect(
        unwrapOne<{ transfer_group_id: string }>(res.body).transfer_group_id,
      ).toBe(createdTransferGroupId);
    });

    it('actualiza el monto/descripción de la transferencia (PATCH :id)', async () => {
      const list = await request(server)
        .get(base)
        .set(...authHeader({ userId }));
      const found = (
        list.body.data as {
          transfer_group_id: string;
          source: { id: number };
        }[]
      ).find((t) => t.transfer_group_id === createdTransferGroupId)!;

      const res = await request(server)
        .patch(`${base}/${found.source.id}`)
        .set(...authHeader({ userId }))
        .send({ description: 'Transferencia renombrada (e2e)' });

      expect(res.status).toBe(200);
      expect(unwrapOne<{ description: string }>(res.body).description).toBe(
        'Transferencia renombrada (e2e)',
      );
    });

    it('clona la transferencia completa (POST :id/clone)', async () => {
      const list = await request(server)
        .get(base)
        .set(...authHeader({ userId }));
      const found = (
        list.body.data as {
          transfer_group_id: string;
          source: { id: number };
        }[]
      ).find((t) => t.transfer_group_id === createdTransferGroupId)!;

      const res = await request(server)
        .post(`${base}/${found.source.id}/clone`)
        .set(...authHeader({ userId }))
        .send({ amount: 300000, description: 'Transferencia clonada (e2e)' });

      expect(res.status).toBe(201);
      const cloned = unwrapOne<{
        transfer_group_id: string;
        amount: string | number;
      }>(res.body);
      expect(Number(cloned.amount)).toBe(300000);
      expect(cloned.transfer_group_id).not.toBe(createdTransferGroupId);
      clonedTransferGroupId = cloned.transfer_group_id;
    });

    it('elimina la transferencia (DELETE :id, soft delete de ambos movimientos)', async () => {
      const list = await request(server)
        .get(base)
        .set(...authHeader({ userId }));
      const found = (
        list.body.data as {
          transfer_group_id: string;
          source: { id: number };
        }[]
      ).find((t) => t.transfer_group_id === clonedTransferGroupId)!;

      const del = await request(server)
        .delete(`${base}/${found.source.id}`)
        .set(...authHeader({ userId }));
      expect(del.status).toBe(204);

      const get = await request(server)
        .get(`${base}/${found.source.id}`)
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

    it('rechaza acceso a transfers de otro usuario (403, OwnershipGuard real)', async () => {
      const res = await request(server)
        .get(base)
        .set(...authHeader({ userId: otherUserId }));
      expect(res.status).toBe(403);
    });

    it('rechaza body inválido en creación (400, ValidationPipe)', async () => {
      const res = await request(server)
        .post(base)
        .set(...authHeader({ userId }))
        .send({ amount: 1000 });
      expect(res.status).toBe(400);
    });

    it('rechaza propiedades no permitidas (400, forbidNonWhitelisted)', async () => {
      const res = await request(server)
        .post(base)
        .set(...authHeader({ userId }))
        .send({
          source_account_id: sourceAccountId,
          destination_account_id: destinationAccountId,
          amount: 1000,
          hacker_field: 'x',
        });
      expect(res.status).toBe(400);
    });

    it('rechaza si no se indica ni destination_account_id ni destination_liability_id (400, DistinctTransferEntitiesConstraint)', async () => {
      const res = await request(server)
        .post(base)
        .set(...authHeader({ userId }))
        .send({
          source_account_id: sourceAccountId,
          amount: 1000,
        });
      expect(res.status).toBe(400);
    });

    it('rechaza si se indican ambos destinos a la vez (400, DistinctTransferEntitiesConstraint)', async () => {
      const res = await request(server)
        .post(base)
        .set(...authHeader({ userId }))
        .send({
          source_account_id: sourceAccountId,
          destination_account_id: destinationAccountId,
          destination_liability_id: 1,
          amount: 1000,
        });
      expect(res.status).toBe(400);
    });

    it('devuelve 404 si la cuenta origen no existe', async () => {
      const res = await request(server)
        .post(base)
        .set(...authHeader({ userId }))
        .send({
          source_account_id: 999999999,
          destination_account_id: destinationAccountId,
          amount: 1000,
        });
      expect(res.status).toBe(404);
    });

    it('devuelve 404 al buscar una transferencia inexistente', async () => {
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

    it('devuelve 404 al actualizar una transferencia inexistente', async () => {
      const res = await request(server)
        .patch(`${base}/999999999`)
        .set(...authHeader({ userId }))
        .send({ description: 'no existe' });
      expect(res.status).toBe(404);
    });

    it('devuelve 404 al clonar una transferencia inexistente', async () => {
      const res = await request(server)
        .post(`${base}/999999999/clone`)
        .set(...authHeader({ userId }))
        .send({});
      expect(res.status).toBe(404);
    });

    it('devuelve 404 al eliminar una transferencia inexistente', async () => {
      const res = await request(server)
        .delete(`${base}/999999999`)
        .set(...authHeader({ userId }));
      expect(res.status).toBe(404);
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

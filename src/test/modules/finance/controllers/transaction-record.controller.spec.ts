import { NotFoundException } from '@nestjs/common';
import { TransactionRecordController } from '@finance/controller/transaction-record.controller';
import { TransactionRecordService } from '@finance/service/transaction-record.service';
import { CreateTransactionRecordDto } from '@finance/dto/transaction-record/create-transaction-record.dto';
import { UpdateTransactionRecordDto } from '@finance/dto/transaction-record/update-transaction-record.dto';
import { TransactionRecordQueryDto } from '@finance/dto/transaction-record/transaction-record-query.dto';
import { TransactionSummaryQueryDto } from '@finance/dto/transaction-record/transaction-summary-query.dto';
import { TransactionTypeEnum } from '@shared/enums';
import { IntrospectResponse } from '@auth/interfaces/IntrospectResponse.dto';

const mockTransactionRecordService = {
  create: jest.fn(),
  findAll: jest.fn(),
  getSummary: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  getUpcomingPayments: jest.fn(),
  removeMany: jest.fn(),
  clone: jest.fn(),
};

const buildTransaction = (overrides = {}) => ({
  id: 1,
  user_id: 10,
  category_id: 2,
  type: TransactionTypeEnum.EXPENSE,
  amount: 50000,
  created_at: new Date(),
  ...overrides,
});

const currentUser: IntrospectResponse = { active: true, sub: 'kc-uuid' };

describe('TransactionRecordController', () => {
  let controller: TransactionRecordController;

  beforeEach(() => {
    controller = new TransactionRecordController(
      mockTransactionRecordService as unknown as TransactionRecordService,
    );
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // create
  // ─────────────────────────────────────────────────────────────
  describe('create', () => {
    const dto: CreateTransactionRecordDto = {
      category_id: 2,
      type: TransactionTypeEnum.EXPENSE,
      amount: 50000,
    };

    it('debe registrar transacción delegando al servicio', async () => {
      const created = buildTransaction();
      mockTransactionRecordService.create.mockResolvedValue(created);

      const result = await controller.create(10, dto, currentUser);

      expect(mockTransactionRecordService.create).toHaveBeenCalledWith(10, dto);
      expect(result).toEqual(created);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // clone
  // ─────────────────────────────────────────────────────────────
  describe('clone', () => {
    it('debe delegar la clonación al servicio', async () => {
      const cloned = buildTransaction({ id: 99 });
      mockTransactionRecordService.clone.mockResolvedValue(cloned);
      const dto = { amount: 20000 };

      const result = await controller.clone(10, 1, dto, currentUser);

      expect(mockTransactionRecordService.clone).toHaveBeenCalledWith(
        1,
        10,
        dto,
      );
      expect(result).toEqual(cloned);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findAll
  // ─────────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('debe retornar transacciones paginadas del usuario', async () => {
      const payload = { data: [buildTransaction()], total: 1 };
      mockTransactionRecordService.findAll.mockResolvedValue(payload);
      const query: TransactionRecordQueryDto = { page: 1, limit: 20 };

      const result = await controller.findAll(10, query, currentUser);

      expect(mockTransactionRecordService.findAll).toHaveBeenCalledWith(
        10,
        query,
      );
      expect(result).toEqual(payload);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // summary
  // ─────────────────────────────────────────────────────────────
  describe('summary', () => {
    it('debe retornar el resumen por intervalo delegando al servicio', async () => {
      const payload = {
        date_from: '2026-08-01',
        date_to: '2026-08-31',
        group_by: 'day' as const,
        totals: { income: 100, expenses: 50, investments: 0, count: 3 },
        by_category: [],
        series: [],
      };
      mockTransactionRecordService.getSummary.mockResolvedValue(payload);
      const query: TransactionSummaryQueryDto = { group_by: 'day' };

      const result = await controller.summary(10, query, currentUser);

      expect(mockTransactionRecordService.getSummary).toHaveBeenCalledWith(
        10,
        query,
      );
      expect(result).toEqual(payload);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findOne
  // ─────────────────────────────────────────────────────────────
  describe('findOne', () => {
    it('debe retornar transacción por id', async () => {
      const tx = buildTransaction();
      mockTransactionRecordService.findOne.mockResolvedValue(tx);

      const result = await controller.findOne(10, 1, currentUser);

      expect(mockTransactionRecordService.findOne).toHaveBeenCalledWith(1, 10);
      expect(result).toEqual(tx);
    });

    it('debe propagar NotFoundException si no existe', async () => {
      mockTransactionRecordService.findOne.mockRejectedValue(
        new NotFoundException(),
      );

      await expect(controller.findOne(10, 999, currentUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // upcomingPayments
  // ─────────────────────────────────────────────────────────────
  describe('upcomingPayments', () => {
    it('debe retornar los próximos pagos envueltos en { data }', async () => {
      const payments = [
        { subscription_id: 1, next_payment_date: '2026-09-01', days_left: 15 },
      ];
      mockTransactionRecordService.getUpcomingPayments.mockResolvedValue(
        payments,
      );

      const result = await controller.upcomingPayments(10, currentUser);

      expect(
        mockTransactionRecordService.getUpcomingPayments,
      ).toHaveBeenCalledWith(10);
      expect(result).toEqual({ data: payments });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // removeMany
  // ─────────────────────────────────────────────────────────────
  describe('removeMany', () => {
    it('debe eliminar en masa y retornar la cantidad', async () => {
      mockTransactionRecordService.removeMany.mockResolvedValue(3);

      const result = await controller.removeMany(
        10,
        { ids: [1, 2, 3] },
        currentUser,
      );

      expect(mockTransactionRecordService.removeMany).toHaveBeenCalledWith(
        [1, 2, 3],
        10,
      );
      expect(result).toEqual({ deleted: 3 });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // update
  // ─────────────────────────────────────────────────────────────
  describe('update', () => {
    it('debe actualizar transacción y retornar el resultado', async () => {
      const dto: UpdateTransactionRecordDto = { amount: 75000 };
      const updated = buildTransaction({ amount: 75000 });
      mockTransactionRecordService.update.mockResolvedValue(updated);

      const result = await controller.update(10, 1, dto, currentUser);

      expect(mockTransactionRecordService.update).toHaveBeenCalledWith(
        1,
        10,
        dto,
      );
      expect(result).toEqual(updated);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // remove
  // ─────────────────────────────────────────────────────────────
  describe('remove', () => {
    it('debe eliminar transacción y retornar undefined', async () => {
      mockTransactionRecordService.remove.mockResolvedValue(undefined);

      const result = await controller.remove(10, 1, currentUser);

      expect(mockTransactionRecordService.remove).toHaveBeenCalledWith(1, 10);
      expect(result).toBeUndefined();
    });
  });
});

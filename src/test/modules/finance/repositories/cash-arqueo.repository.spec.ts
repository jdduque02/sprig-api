import { NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { CashArqueoRepository } from '@finance/repositories/cash-arqueo.repository';
import {
  CashArqueo,
  CashArqueoStatusEnum,
} from '@finance/entities/cash-arqueo.entity';
import { TransactionTypeEnum } from '@shared/enums';

const mockRepo = {
  create: jest.fn((e: Partial<CashArqueo>) => e),
  save: jest.fn((e: Partial<CashArqueo>) => ({ id: 1, ...e })),
  find: jest.fn(),
  findOne: jest.fn(),
  softRemove: jest.fn(),
};

const buildQb = (rows: unknown[]) => {
  const qb = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(rows),
  };
  return qb;
};

const mockTransactionRepo = { createQueryBuilder: jest.fn() };
const mockI18n = { t: jest.fn((key: string) => key) };

const buildRow = (overrides = {}) => ({
  transaction_date: '2026-08-01',
  amount: '1000',
  description: 'Pago',
  type: TransactionTypeEnum.EXPENSE,
  source: 'manual',
  ...overrides,
});

describe('CashArqueoRepository', () => {
  let repo: CashArqueoRepository;

  beforeEach(() => {
    repo = new CashArqueoRepository(
      mockRepo as never,
      mockTransactionRepo as never,
      mockI18n as unknown as I18nService,
    );
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('marca como balanceado cuando no hay diferencia', async () => {
      const dto = {
        counted_amount: 5000,
        expected_amount: 5000,
        arqueo_date: '2026-08-15',
        observations: null,
      };
      const result = await repo.create(
        10,
        dto as never,
        { expected_amount: 5000 } as never,
      );
      expect(result.status).toBe(CashArqueoStatusEnum.BALANCED);
      expect(result.difference).toBe(0);
    });

    it('marca como no balanceado con diferencia', async () => {
      const dto = { counted_amount: 4000, arqueo_date: '2026-08-15' };
      const result = await repo.create(10, dto, {
        expected_amount: 5000,
      } as never);
      expect(result.status).toBe(CashArqueoStatusEnum.UNBALANCED);
      expect(result.difference).toBe(-1000);
    });

    it('usa expected_amount de la reconciliación por defecto', async () => {
      const dto = { counted_amount: 8000 };
      const result = await repo.create(10, dto, {
        expected_amount: 7000,
      } as never);
      expect(result.expected_amount).toBe(7000);
    });

    it('usa el mes actual cuando no hay fecha', async () => {
      const dto = { counted_amount: 1000, expected_amount: 1000 };
      const today = new Date().toISOString().slice(0, 10);
      const result = await repo.create(10, dto, {
        expected_amount: 1000,
      } as never);
      expect(String(result.arqueo_date).slice(0, 10)).toBe(today);
    });

    it('usa 0 como counted_amount cuando no viene', async () => {
      const dto = { expected_amount: 5000 };
      const result = await repo.create(
        10,
        dto as never,
        { expected_amount: 5000 } as never,
      );
      expect(result.counted_amount).toBe(0);
      expect(result.difference).toBe(-5000);
      expect(result.status).toBe(CashArqueoStatusEnum.UNBALANCED);
    });
  });

  describe('findAll', () => {
    it('lista arqueos no eliminados', async () => {
      mockRepo.find.mockResolvedValue([{ id: 1 }]);
      await repo.findAll(10);
      expect(mockRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ user_id: 10 }) as Record<
            string,
            unknown
          >,
        }),
      );
    });
  });

  describe('findById', () => {
    it('lanza NotFoundException si no existe', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(repo.findById(99, 10)).rejects.toThrow(NotFoundException);
    });

    it('retorna el arqueo', async () => {
      mockRepo.findOne.mockResolvedValue({ id: 2 });
      await expect(repo.findById(2, 10)).resolves.toEqual({ id: 2 });
    });
  });

  describe('softDelete', () => {
    it('hace soft remove', async () => {
      const entity = { id: 3 };
      mockRepo.findOne.mockResolvedValue(entity);
      await repo.softDelete(3, 10);
      expect(mockRepo.softRemove).toHaveBeenCalledWith(entity);
    });
  });

  describe('getReconciliation', () => {
    it('lanza NotFoundException con mes inválido', async () => {
      await expect(repo.getReconciliation(10, 'mal')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lanza NotFoundException con mes fuera de rango', async () => {
      await expect(repo.getReconciliation(10, '2026-13')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('computa totales, coincidencias y discrepancias', async () => {
      mockTransactionRepo.createQueryBuilder.mockReturnValue(
        buildQb([
          buildRow({
            transaction_date: '2026-08-01',
            amount: '1000',
            type: TransactionTypeEnum.EXPENSE,
            source: 'manual',
          }),
          buildRow({
            transaction_date: '2026-08-01',
            amount: '1000',
            type: TransactionTypeEnum.EXPENSE,
            source: 'import',
          }),
          buildRow({
            transaction_date: '2026-08-02',
            amount: '2000',
            type: TransactionTypeEnum.INCOME,
            source: 'manual',
          }),
          buildRow({
            transaction_date: '2026-08-03',
            amount: '500',
            type: TransactionTypeEnum.TRANSFER,
            source: 'manual',
          }),
          buildRow({
            transaction_date: '2026-08-04',
            amount: '700',
            type: TransactionTypeEnum.EXPENSE,
            source: 'import',
          }),
        ]),
      );

      const result = await repo.getReconciliation(10, '2026-08');
      expect(result.month).toBe('2026-08');
      expect(result.app.count).toBe(2);
      expect(result.app.expense).toBe(1000);
      expect(result.app.income).toBe(2000);
      expect(result.extract.count).toBe(2);
      expect(result.matched.count).toBe(1);
      expect(result.app_only.count).toBe(1);
      expect(result.extract_only.count).toBe(1);
      expect(result.expected_amount).toBe(-1700);
    });

    it('usa app.net cuando no hay movimientos importados', async () => {
      mockTransactionRepo.createQueryBuilder.mockReturnValue(
        buildQb([
          buildRow({
            transaction_date: '2026-08-01',
            amount: '1000',
            type: TransactionTypeEnum.EXPENSE,
            source: 'manual',
          }),
        ]),
      );
      const result = await repo.getReconciliation(10, '2026-08');
      expect(result.expected_amount).toBe(-1000);
    });

    it('maneja filas sin monto ni descripción y huellas duplicadas', async () => {
      mockTransactionRepo.createQueryBuilder.mockReturnValue(
        buildQb([
          buildRow({
            transaction_date: '2026-08-01',
            amount: undefined,
            description: undefined,
            type: TransactionTypeEnum.EXPENSE,
            source: 'manual',
          }),
          buildRow({
            transaction_date: '2026-08-01',
            amount: undefined,
            description: undefined,
            type: TransactionTypeEnum.EXPENSE,
            source: 'manual',
          }),
          buildRow({
            transaction_date: '2026-08-02',
            amount: undefined,
            description: 'Importe',
            type: TransactionTypeEnum.INCOME,
            source: 'import',
          }),
        ]),
      );

      const result = await repo.getReconciliation(10, '2026-08');
      expect(result.app.count).toBe(2);
      expect(result.app.expense).toBe(0);
      expect(result.extract.count).toBe(1);
      expect(result.matched.count).toBe(0);
      expect(result.app_only.count).toBe(1);
      expect(result.app_only.amount).toBe(0);
      expect(result.extract_only.count).toBe(1);
      expect(result.extract_only.amount).toBe(0);
      expect(result.expected_amount).toBe(0);
    });
  });
});

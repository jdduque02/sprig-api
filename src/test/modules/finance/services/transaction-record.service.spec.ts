import { Test, TestingModule } from '@nestjs/testing';
import { TransactionRecordService } from '@finance/service/transaction-record.service';
import { TransactionRecordRepository } from '@finance/repositories/transaction-record.repository';
import { CreateTransactionRecordDto } from '@finance/dto/transaction-record/create-transaction-record.dto';
import { UpdateTransactionRecordDto } from '@finance/dto/transaction-record/update-transaction-record.dto';
import { TransactionRecordQueryDto } from '@finance/dto/transaction-record/transaction-record-query.dto';
import { NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { TransactionTypeEnum, FrequencyEnum } from '@shared/enums';

const mockCacheManager = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

const mockTransactionRecordRepository = {
  create: jest.fn(),
  findAll: jest.fn(),
  getSummary: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
  softDeleteMany: jest.fn(),
  findUpcomingSubscriptions: jest.fn(),
};

const buildTransaction = (overrides = {}) => ({
  id: 1,
  user_id: 10,
  category_id: 2,
  type: TransactionTypeEnum.EXPENSE,
  amount: 50000,
  ...overrides,
});

const buildSubscription = (overrides = {}) => ({
  id: 1,
  user_id: 10,
  type: TransactionTypeEnum.EXPENSE,
  amount: '30000',
  is_fixed: true,
  fixed_type: 'deduction',
  frequency: FrequencyEnum.MONTHLY,
  due_day: 20,
  reminder_days: 3,
  description: 'Suscripción Netflix',
  payment_method: 'debit_card',
  created_at: new Date('2026-01-01'),
  ...overrides,
});

describe('TransactionRecordService', () => {
  let service: TransactionRecordService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionRecordService,
        {
          provide: TransactionRecordRepository,
          useValue: mockTransactionRecordRepository,
        },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
      ],
    }).compile();

    service = module.get<TransactionRecordService>(TransactionRecordService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('debe delegar la creación al repositorio', async () => {
      const dto: CreateTransactionRecordDto = {
        category_id: 2,
        type: TransactionTypeEnum.EXPENSE,
        amount: 50000,
      };
      const created = buildTransaction();
      mockTransactionRecordRepository.create.mockResolvedValue(created);

      const result = await service.create(10, dto);

      expect(mockTransactionRecordRepository.create).toHaveBeenCalledWith(
        10,
        dto,
      );
      expect(result).toEqual(created);
    });
  });

  describe('findAll', () => {
    it('debe delegar la búsqueda paginada al repositorio', async () => {
      const payload = { data: [buildTransaction()], total: 1 };
      const query: TransactionRecordQueryDto = { page: 1, limit: 20 };
      mockTransactionRecordRepository.findAll.mockResolvedValue(payload);

      const result = await service.findAll(10, query);

      expect(mockTransactionRecordRepository.findAll).toHaveBeenCalledWith(
        10,
        query,
      );
      expect(result).toEqual(payload);
    });
  });

  describe('findOne', () => {
    it('debe retornar transacción por id', async () => {
      const tx = buildTransaction();
      mockTransactionRecordRepository.findById.mockResolvedValue(tx);

      const result = await service.findOne(1, 10);

      expect(mockTransactionRecordRepository.findById).toHaveBeenCalledWith(
        1,
        10,
      );
      expect(result).toEqual(tx);
    });

    it('debe propagar NotFoundException del repositorio', async () => {
      mockTransactionRecordRepository.findById.mockRejectedValue(
        new NotFoundException(),
      );

      await expect(service.findOne(999, 10)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getSummary', () => {
    it('debe delegar el resumen por intervalo al repositorio', async () => {
      const payload = {
        date_from: '2026-08-01',
        date_to: '2026-08-31',
        group_by: 'day',
        totals: { income: 0, expenses: 0, investments: 0, count: 0 },
        by_category: [],
        series: [],
      };
      mockTransactionRecordRepository.getSummary.mockResolvedValue(payload);

      const result = await service.getSummary(10, {
        date_from: '2026-08-01',
        date_to: '2026-08-31',
      });

      expect(mockTransactionRecordRepository.getSummary).toHaveBeenCalledWith(
        10,
        {
          date_from: '2026-08-01',
          date_to: '2026-08-31',
        },
      );
      expect(result).toEqual(payload);
    });

    it('debe devolver el resumen desde la caché sin consultar al repositorio', async () => {
      const summary = { totals: { income: 100 } };
      mockCacheManager.get
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(summary);

      const result = await service.getSummary(10, {
        date_from: '2026-08-01',
        date_to: '2026-08-31',
        group_by: 'week',
        type: TransactionTypeEnum.INCOME,
      });

      expect(mockTransactionRecordRepository.getSummary).not.toHaveBeenCalled();
      expect(mockCacheManager.get).toHaveBeenCalledWith('tx:summary:gen:10');
      expect(mockCacheManager.get).toHaveBeenCalledWith(
        'tx:summary:10:2026-08-01:2026-08-31:week:income:g3',
      );
      expect(result).toEqual(summary);
    });

    it('debe usar valores por defecto en la clave cuando el query viene vacío', async () => {
      const payload = { totals: {} };
      mockCacheManager.get.mockResolvedValue(undefined);
      mockTransactionRecordRepository.getSummary.mockResolvedValue(payload);

      const result = await service.getSummary(10, {});

      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'tx:summary:10:::day::g0',
        payload,
        expect.any(Number),
      );
      expect(result).toEqual(payload);
    });
  });

  describe('update', () => {
    it('debe delegar la actualización al repositorio', async () => {
      const dto: UpdateTransactionRecordDto = { amount: 75000 };
      const updated = buildTransaction({ amount: 75000 });
      mockTransactionRecordRepository.update.mockResolvedValue(updated);

      const result = await service.update(1, 10, dto);

      expect(mockTransactionRecordRepository.update).toHaveBeenCalledWith(
        1,
        10,
        dto,
      );
      expect(result).toEqual(updated);
    });
  });

  describe('remove', () => {
    it('debe delegar el soft delete al repositorio', async () => {
      mockTransactionRecordRepository.softDelete.mockResolvedValue(undefined);

      await service.remove(1, 10);

      expect(mockTransactionRecordRepository.softDelete).toHaveBeenCalledWith(
        1,
        10,
      );
    });
  });

  describe('removeMany', () => {
    it('debe delegar la eliminación masiva e incrementar la generación de caché', async () => {
      mockTransactionRecordRepository.softDeleteMany.mockResolvedValue(2);
      mockCacheManager.get.mockResolvedValueOnce(7);

      const result = await service.removeMany([1, 2], 10);

      expect(
        mockTransactionRecordRepository.softDeleteMany,
      ).toHaveBeenCalledWith([1, 2], 10);
      expect(result).toBe(2);
      expect(mockCacheManager.get).toHaveBeenCalledWith('tx:summary:gen:10');
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'tx:summary:gen:10',
        8,
        86_400_000,
      );
    });
  });

  describe('getUpcomingPayments', () => {
    it('debe calcular los próximos pagos de suscripciones ordenados por fecha', async () => {
      const monthly = buildSubscription({ id: 1 });
      const daily = buildSubscription({
        id: 2,
        frequency: FrequencyEnum.DAILY,
        due_day: null,
        description: null,
        amount: undefined,
        payment_method: null,
        reminder_days: null,
      });
      mockTransactionRecordRepository.findUpcomingSubscriptions.mockResolvedValue(
        [monthly, daily],
      );

      const result = await service.getUpcomingPayments(10);

      expect(
        mockTransactionRecordRepository.findUpcomingSubscriptions,
      ).toHaveBeenCalledWith(10, expect.any(Date));
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(2);
      expect(result[0].frequency).toBe('daily');
      expect(result[0].description).toBeNull();
      expect(result[0].amount).toBe(0);
      expect(result[0].payment_method).toBeNull();
      expect(result[0].due_day).toBeNull();
      expect(result[0].reminder_days).toBeNull();
      expect(result[0].days_remaining).toBe(0);
      expect(result[0].next_payment_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result[1].id).toBe(1);
      expect(result[1].description).toBe('Suscripción Netflix');
      expect(result[1].amount).toBe(30000);
      expect(result[1].payment_method).toBe('debit_card');
      expect(result[1].frequency).toBe('monthly');
      expect(result[1].due_day).toBe(20);
      expect(result[1].reminder_days).toBe(3);
    });

    it('debe respetar el orden ya ordenado de los próximos pagos', async () => {
      const daily = buildSubscription({
        id: 2,
        frequency: FrequencyEnum.DAILY,
        due_day: null,
      });
      const monthly = buildSubscription({ id: 1 });
      mockTransactionRecordRepository.findUpcomingSubscriptions.mockResolvedValue(
        [daily, monthly],
      );

      const result = await service.getUpcomingPayments(10);

      expect(result.map((p) => p.id)).toEqual([2, 1]);
    });

    it('debe omitir suscripciones sin siguiente ocurrencia', async () => {
      const noNext = buildSubscription({
        id: 3,
        frequency: null,
        due_day: null,
      });
      mockTransactionRecordRepository.findUpcomingSubscriptions.mockResolvedValue(
        [noNext],
      );

      const result = await service.getUpcomingPayments(10);

      expect(result).toEqual([]);
    });

    it('debe calcular la siguiente ocurrencia con frecuencia nula si hay due_day', async () => {
      const noFrequency = buildSubscription({
        id: 4,
        frequency: null,
        due_day: 20,
      });
      mockTransactionRecordRepository.findUpcomingSubscriptions.mockResolvedValue(
        [noFrequency],
      );

      const result = await service.getUpcomingPayments(10);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(4);
      expect(result[0].frequency).toBeNull();
      expect(result[0].due_day).toBe(20);
      expect(result[0].next_payment_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});

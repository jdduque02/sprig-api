import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { TransactionRecordService } from '@finance/service/transaction-record.service';
import { TransactionRecordRepository } from '@finance/repositories/transaction-record.repository';
import { TransactionSummaryQueryDto } from '@finance/dto/transaction-record/transaction-summary-query.dto';
import { TransactionRecordQueryDto } from '@finance/dto/transaction-record/transaction-record-query.dto';
import { CreateTransactionRecordDto } from '@finance/dto/transaction-record/create-transaction-record.dto';
import { UpdateTransactionRecordDto } from '@finance/dto/transaction-record/update-transaction-record.dto';
import { CloneTransactionDto } from '@finance/dto/transaction-record/clone-transaction.dto';
import { TransactionTypeEnum, FrequencyEnum } from '@shared/enums';

const mockCacheManager = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

const mockRepository = {
  create: jest.fn(),
  findAll: jest.fn(),
  getSummary: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
  softDeleteMany: jest.fn(),
  clone: jest.fn(),
  findUpcomingSubscriptions: jest.fn(),
};

const buildTx = (overrides = {}) => ({
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
  description: 'Netflix',
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
          useValue: mockRepository,
        },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
      ],
    }).compile();

    service = module.get<TransactionRecordService>(TransactionRecordService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('debe llamar al repositorio e invalidar la caché', async () => {
      const dto: CreateTransactionRecordDto = {
        category_id: 2,
        type: TransactionTypeEnum.EXPENSE,
        amount: 50000,
      };
      const created = buildTx();
      mockRepository.create.mockResolvedValue(created);
      mockCacheManager.get.mockResolvedValue(0);

      const result = await service.create(10, dto);

      expect(mockRepository.create).toHaveBeenCalledWith(10, dto);
      expect(result).toEqual(created);
      expect(mockCacheManager.get).toHaveBeenCalledWith('tx:summary:gen:10');
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'tx:summary:gen:10',
        1,
        86_400_000,
      );
    });
  });

  describe('findAll', () => {
    it('debe delegar al repositorio', async () => {
      const query: TransactionRecordQueryDto = { page: 1, limit: 20 };
      const payload = { data: [buildTx()], total: 1 };
      mockRepository.findAll.mockResolvedValue(payload);

      const result = await service.findAll(10, query);

      expect(mockRepository.findAll).toHaveBeenCalledWith(10, query);
      expect(result).toEqual(payload);
    });
  });

  describe('getSummary', () => {
    it('debe devolver resultado desde la caché cuando existe', async () => {
      const cached = { totals: { income: 100 } };
      mockCacheManager.get
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(cached);

      const result = await service.getSummary(10, {
        date_from: '2026-08-01',
        date_to: '2026-08-31',
        group_by: 'week',
        type: TransactionTypeEnum.INCOME,
      });

      expect(mockRepository.getSummary).not.toHaveBeenCalled();
      expect(result).toEqual(cached);
    });

    it('debe consultar repositorio y almacenar en caché cuando no hay cache', async () => {
      const summary = { totals: {}, by_category: [], series: [] };
      mockCacheManager.get.mockResolvedValue(undefined);
      mockRepository.getSummary.mockResolvedValue(summary);

      const result = await service.getSummary(10, {
        date_from: '2026-08-01',
        date_to: '2026-08-31',
      });

      expect(mockRepository.getSummary).toHaveBeenCalledWith(10, {
        date_from: '2026-08-01',
        date_to: '2026-08-31',
      });
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'tx:summary:10:2026-08-01:2026-08-31:day::g0',
        summary,
        expect.any(Number),
      );
      expect(result).toEqual(summary);
    });

    it('debe usar valores por defecto en la clave de caché', async () => {
      const payload = { totals: {} };
      mockCacheManager.get.mockResolvedValue(undefined);
      mockRepository.getSummary.mockResolvedValue(payload);

      await service.getSummary(10, {});

      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'tx:summary:10:::day::g0',
        payload,
        expect.any(Number),
      );
    });
  });

  describe('findOne', () => {
    it('debe delegar al repositorio.findById', async () => {
      const tx = buildTx();
      mockRepository.findById.mockResolvedValue(tx);

      const result = await service.findOne(1, 10);

      expect(mockRepository.findById).toHaveBeenCalledWith(1, 10);
      expect(result).toEqual(tx);
    });
  });

  describe('update', () => {
    it('debe llamar al repositorio e invalidar la caché', async () => {
      const dto: UpdateTransactionRecordDto = { amount: 75000 };
      const updated = buildTx({ amount: 75000 });
      mockRepository.update.mockResolvedValue(updated);
      mockCacheManager.get.mockResolvedValue(5);

      const result = await service.update(1, 10, dto);

      expect(mockRepository.update).toHaveBeenCalledWith(1, 10, dto);
      expect(result).toEqual(updated);
      expect(mockCacheManager.get).toHaveBeenCalledWith('tx:summary:gen:10');
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'tx:summary:gen:10',
        6,
        86_400_000,
      );
    });
  });

  describe('remove', () => {
    it('debe llamar softDelete e invalidar la caché', async () => {
      mockRepository.softDelete.mockResolvedValue(undefined);
      mockCacheManager.get.mockResolvedValue(0);

      await service.remove(1, 10);

      expect(mockRepository.softDelete).toHaveBeenCalledWith(1, 10);
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'tx:summary:gen:10',
        1,
        86_400_000,
      );
    });
  });

  describe('removeMany', () => {
    it('debe delegar y invalidar la caché', async () => {
      mockRepository.softDeleteMany.mockResolvedValue(2);
      mockCacheManager.get.mockResolvedValue(7);

      const result = await service.removeMany([1, 2], 10);

      expect(mockRepository.softDeleteMany).toHaveBeenCalledWith([1, 2], 10);
      expect(result).toBe(2);
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'tx:summary:gen:10',
        8,
        86_400_000,
      );
    });
  });

  describe('clone', () => {
    it('debe delegar al repositorio e invalidar la caché', async () => {
      const dto: CloneTransactionDto = { amount: 10000 };
      const cloned = buildTx({ id: 99, amount: 10000 });
      mockRepository.clone.mockResolvedValue(cloned);
      mockCacheManager.get.mockResolvedValue(0);

      const result = await service.clone(1, 10, dto);

      expect(mockRepository.clone).toHaveBeenCalledWith(1, 10, dto);
      expect(result).toEqual(cloned);
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'tx:summary:gen:10',
        1,
        86_400_000,
      );
    });
  });

  describe('getUpcomingPayments', () => {
    it('debe calcular próximos pagos ordenados por fecha', async () => {
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
      mockRepository.findUpcomingSubscriptions.mockResolvedValue([
        monthly,
        daily,
      ]);

      const result = await service.getUpcomingPayments(10);

      expect(mockRepository.findUpcomingSubscriptions).toHaveBeenCalledWith(
        10,
        expect.any(Date),
      );
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(2);
      expect(result[0].frequency).toBe('daily');
      expect(result[0].amount).toBe(0);
      expect(result[0].description).toBeNull();
      expect(result[0].next_payment_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result[1].id).toBe(1);
      expect(result[1].description).toBe('Netflix');
      expect(result[1].amount).toBe(30000);
    });

    it('debe omitir suscripciones sin siguiente ocurrencia', async () => {
      const noNext = buildSubscription({
        id: 3,
        frequency: null,
        due_day: null,
      });
      mockRepository.findUpcomingSubscriptions.mockResolvedValue([noNext]);

      const result = await service.getUpcomingPayments(10);

      expect(result).toEqual([]);
    });

    it('debe calcular ocurrencia con frecuencia nula y due_day presente', async () => {
      const noFreq = buildSubscription({
        id: 4,
        frequency: null,
        due_day: 20,
      });
      mockRepository.findUpcomingSubscriptions.mockResolvedValue([noFreq]);

      const result = await service.getUpcomingPayments(10);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(4);
      expect(result[0].frequency).toBeNull();
      expect(result[0].due_day).toBe(20);
      expect(result[0].next_payment_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('debe retornar array vacío cuando no hay suscripciones', async () => {
      mockRepository.findUpcomingSubscriptions.mockResolvedValue([]);

      const result = await service.getUpcomingPayments(10);

      expect(result).toEqual([]);
    });
  });
});

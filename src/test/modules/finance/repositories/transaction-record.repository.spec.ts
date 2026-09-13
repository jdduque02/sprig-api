import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { I18nService } from 'nestjs-i18n';
import { TransactionRecordRepository } from '@finance/repositories/transaction-record.repository';
import { TransactionRecord } from '@finance/entities/transaction-record.entity';
import { TransactionCategoryRule } from '@finance/entities/transaction-category-rule.entity';
import { FinancialObjective } from '@finance/entities/financial-objective.entity';
import { Empresa } from '@finance/entities/empresa.entity';
import { CreateTransactionRecordDto } from '@finance/dto/transaction-record/create-transaction-record.dto';
import { UpdateTransactionRecordDto } from '@finance/dto/transaction-record/update-transaction-record.dto';
import { TransactionRecordQueryDto } from '@finance/dto/transaction-record/transaction-record-query.dto';
import { BankAccount } from '@banking/entities/bank-account.entity';
import { FinancialAsset } from '@banking/entities/financial-asset.entity';
import { FinancialLiability } from '@banking/entities/financial-liability.entity';
import { EncryptionService } from '@shared/services/encryption.service';
import { ReviewStatusEnum } from '@shared/enums';

// ─────────────────────────────────────────────────────────────
// QueryBuilder mock
// ─────────────────────────────────────────────────────────────
type TransactionRecordRepoMock = jest.Mocked<
  Pick<
    Repository<TransactionRecord>,
    | 'create'
    | 'save'
    | 'findOne'
    | 'findOneBy'
    | 'find'
    | 'merge'
    | 'softRemove'
    | 'createQueryBuilder'
  >
>;

const mockQb = {
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  addOrderBy: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  addGroupBy: jest.fn().mockReturnThis(),
  setParameter: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  execute: jest.fn().mockResolvedValue({ affected: 0 }),
  getMany: jest.fn(),
  getManyAndCount: jest.fn(),
  getRawMany: jest.fn(),
};

const mockTypeOrmRepo: TransactionRecordRepoMock = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  findOneBy: jest.fn(),
  find: jest.fn(),
  merge: jest.fn(),
  softRemove: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnValue(mockQb),
};

const mockCategoryRuleRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  upsert: jest.fn(),
};

const mockManager = {
  getRepository: jest.fn().mockReturnValue(mockTypeOrmRepo),
};

const mockEmpresaRepo = {
  find: jest.fn(),
};

const mockDataSource = {
  transaction: jest.fn((cb: (manager: typeof mockManager) => unknown) =>
    cb(mockManager),
  ),
  getRepository: jest.fn().mockReturnValue(mockEmpresaRepo),
};

const mockEncryptionService = {
  encryptField: jest.fn((v: string | null) => v),
  decryptField: jest.fn((v: string | null) => v),
};

const mockI18nService = {
  t: jest.fn().mockReturnValue('Transacción no encontrada'),
};

const buildRecord = (overrides = {}): TransactionRecord =>
  ({
    id: 1,
    user_id: 10,
    amount: 100,
    type: 'EXPENSE',
    category_id: 1,
    deleted_at: null,
    transaction_date: new Date('2024-01-15'),
    created_at: new Date('2024-01-15'),
    objective_id: null,
    account_id: null,
    asset_id: null,
    liability_id: null,
    ...overrides,
  }) as unknown as TransactionRecord;

const linkedRepos = new Map<string, TransactionRecordRepoMock>([
  [FinancialObjective.name, { ...mockTypeOrmRepo }],
  [BankAccount.name, { ...mockTypeOrmRepo }],
  [FinancialAsset.name, { ...mockTypeOrmRepo }],
  [FinancialLiability.name, { ...mockTypeOrmRepo }],
]);

describe('TransactionRecordRepository', () => {
  let repo: TransactionRecordRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionRecordRepository,
        {
          provide: getRepositoryToken(TransactionRecord),
          useValue: mockTypeOrmRepo,
        },
        {
          provide: getRepositoryToken(TransactionCategoryRule),
          useValue: mockCategoryRuleRepo,
        },
        { provide: I18nService, useValue: mockI18nService },
        { provide: EncryptionService, useValue: mockEncryptionService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    repo = module.get<TransactionRecordRepository>(TransactionRecordRepository);
    jest.clearAllMocks();
    // restaurar encadenamiento del QB después del clearAllMocks
    mockQb.where.mockReturnThis();
    mockQb.andWhere.mockReturnThis();
    mockQb.orderBy.mockReturnThis();
    mockQb.addOrderBy.mockReturnThis();
    mockQb.take.mockReturnThis();
    mockQb.skip.mockReturnThis();
    mockQb.select.mockReturnThis();
    mockQb.addSelect.mockReturnThis();
    mockQb.groupBy.mockReturnThis();
    mockQb.addGroupBy.mockReturnThis();
    mockQb.setParameter.mockReturnThis();
    mockQb.update.mockReturnThis();
    mockQb.set.mockReturnThis();
    mockTypeOrmRepo.createQueryBuilder.mockReturnValue(mockQb);
    mockDataSource.getRepository.mockReturnValue(mockEmpresaRepo);
    mockManager.getRepository.mockImplementation((entity: unknown) => {
      if (entity === TransactionRecord) return mockTypeOrmRepo;
      if (entity === TransactionCategoryRule) return mockCategoryRuleRepo;
      const name = (entity as { name?: string } | null)?.name;
      return linkedRepos.get(name ?? '') ?? mockTypeOrmRepo;
    });
  });

  // ─────────────────────────────────────────────────────────────
  // create
  // ─────────────────────────────────────────────────────────────
  describe('create', () => {
    const dto: CreateTransactionRecordDto = {
      amount: 100,
      type: 'EXPENSE' as unknown as CreateTransactionRecordDto['type'],
      category_id: 1,
    };

    it('debe crear y guardar la transacción exitosamente', async () => {
      const record = buildRecord();
      mockTypeOrmRepo.create.mockReturnValue(record);
      mockTypeOrmRepo.save.mockResolvedValue(record);

      const result = await repo.create(10, dto);

      expect(mockTypeOrmRepo.create).toHaveBeenCalledWith({
        ...dto,
        user_id: 10,
      });
      expect(result).toEqual(record);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // vínculos meta / patrimonio (ajuste de saldos)
  // ─────────────────────────────────────────────────────────────
  describe('vínculos meta / patrimonio', () => {
    const defaultLinkedEntity = {
      objective: { id: 3, user_id: 10, current_balance: 1000 },
      account: { id: 1, user_id: 10, encrypted_balance: '1000' },
      asset: { id: 2, user_id: 10, current_value: 500 },
      liability: { id: 4, user_id: 10, current_balance: 2000 },
    };

    beforeEach(() => {
      mockTypeOrmRepo.save.mockImplementation((entity: TransactionRecord) =>
        Promise.resolve(entity),
      );
      mockTypeOrmRepo.findOneBy.mockImplementation(
        (criteria: { id?: number }) => {
          const entity =
            criteria?.id === 999
              ? null
              : {
                  ...defaultLinkedEntity[
                    criteria?.id === 3
                      ? 'objective'
                      : criteria?.id === 1
                        ? 'account'
                        : criteria?.id === 2
                          ? 'asset'
                          : 'liability'
                  ],
                };
          return Promise.resolve(entity);
        },
      );
    });

    it('create: ingreso vinculado a una meta suma a current_balance', async () => {
      const saved = buildRecord({
        amount: 100,
        type: 'income',
        objective_id: 3,
      });
      mockTypeOrmRepo.create.mockReturnValue(saved);

      await repo.create(10, {
        amount: 100,
        type: 'income' as unknown as CreateTransactionRecordDto['type'],
        category_id: 1,
        objective_id: 3,
      });

      const objectiveSave = mockTypeOrmRepo.save.mock.calls.find(
        (call) => call[0]?.current_balance !== undefined && call[0]?.id === 3,
      );
      expect(objectiveSave).toBeDefined();
      expect(objectiveSave![0].current_balance).toBe(1100);
    });

    it('create: gasto vinculado a un pasivo reduce su saldo (abono)', async () => {
      const saved = buildRecord({
        amount: 250,
        type: 'expense',
        liability_id: 4,
      });
      mockTypeOrmRepo.create.mockReturnValue(saved);

      await repo.create(10, {
        amount: 250,
        type: 'expense' as unknown as CreateTransactionRecordDto['type'],
        category_id: 1,
        liability_id: 4,
      });

      const liabilitySave = mockTypeOrmRepo.save.mock.calls.find(
        (call) => call[0]?.current_balance !== undefined && call[0]?.id === 4,
      );
      expect(liabilitySave).toBeDefined();
      expect(liabilitySave![0].current_balance).toBe(1750);
    });

    it('update: cambio de monto de transacción vinculada a cuenta ajusta el saldo (revert + apply)', async () => {
      const old = buildRecord({ amount: 100, type: 'expense', account_id: 1 });
      const updated = buildRecord({
        amount: 150,
        type: 'expense',
        account_id: 1,
      });
      mockTypeOrmRepo.findOne.mockResolvedValue(old);
      mockTypeOrmRepo.merge.mockReturnValue(updated);

      await repo.update(1, 10, { amount: 150 });

      const accountSave = mockTypeOrmRepo.save.mock.calls.find(
        (call) => call[0]?.encrypted_balance !== undefined && call[0]?.id === 1,
      );
      expect(accountSave).toBeDefined();
      expect(accountSave![0].encrypted_balance).toBe('950');
    });

    it('update: vincular una meta por actualización suma al saldo aunque merge mute `old`', async () => {
      const old = buildRecord({ type: 'expense', objective_id: null });
      const linked = buildRecord({ type: 'investment', objective_id: 3 });
      mockTypeOrmRepo.findOne.mockResolvedValue(old);
      // Simula Repository.merge(): muta `old` en su lugar en lugar de
      // devolver un objeto nuevo; así el snapshot previo es imprescindible.
      mockTypeOrmRepo.merge.mockImplementation((target: TransactionRecord) => {
        Object.assign(target, linked);
        return target;
      });

      await repo.update(1, 10, { type: 'investment', objective_id: 3 });

      const objectiveSave = mockTypeOrmRepo.save.mock.calls.find(
        (call) => call[0]?.current_balance !== undefined && call[0]?.id === 3,
      );
      expect(objectiveSave).toBeDefined();
      expect(objectiveSave![0].current_balance).toBe(1100);
    });

    it('softDelete: eliminar transacción vinculada a activo revierte el valor', async () => {
      const old = buildRecord({ amount: 100, type: 'investment', asset_id: 2 });
      mockTypeOrmRepo.findOne.mockResolvedValue(old);

      await repo.softDelete(1, 10);

      const assetSave = mockTypeOrmRepo.save.mock.calls.find(
        (call) => call[0]?.current_value !== undefined && call[0]?.id === 2,
      );
      expect(assetSave).toBeDefined();
      expect(assetSave![0].current_value).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findAll
  // ─────────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('debe retornar transacciones con paginación básica', async () => {
      const records = [buildRecord()];
      mockQb.getManyAndCount.mockResolvedValue([records, 1]);

      const query: TransactionRecordQueryDto = { page: 1, limit: 20 };
      const result = await repo.findAll(10, query);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockQb.where).toHaveBeenCalledWith('tr.user_id = :userId', {
        userId: 10,
      });
    });

    it('debe aplicar filtros opcionales cuando se proveen', async () => {
      const records = [buildRecord()];
      mockQb.getManyAndCount.mockResolvedValue([records, 1]);

      const query: TransactionRecordQueryDto = {
        page: 1,
        limit: 10,
        category_id: 1,
        subcategory_id: 2,
        type: 'EXPENSE' as unknown as TransactionRecordQueryDto['type'],
        date_from: new Date('2024-01-01'),
        date_to: new Date('2024-01-31'),
      };
      await repo.findAll(10, query);

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'tr.transaction_date >= :date_from',
        { date_from: query.date_from },
      );
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'tr.transaction_date <= :date_to',
        { date_to: query.date_to },
      );
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'tr.category_id = :category_id',
        { category_id: 1 },
      );
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'tr.subcategory_id = :subcategory_id',
        { subcategory_id: 2 },
      );
      expect(mockQb.andWhere).toHaveBeenCalledWith('tr.type = :type', {
        type: 'EXPENSE',
      });
    });

    it('debe limitar el page size a 500', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);

      await repo.findAll(10, { page: 1, limit: 500 });

      expect(mockQb.take).toHaveBeenCalledWith(500);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findById
  // ─────────────────────────────────────────────────────────────
  describe('findById', () => {
    it('debe retornar la transacción existente', async () => {
      const record = buildRecord();
      mockTypeOrmRepo.findOne.mockResolvedValue(record);

      const result = await repo.findById(1, 10);

      expect(result).toEqual(record);
    });

    it('debe lanzar NotFoundException si no existe', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      await expect(repo.findById(999, 10)).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findFixedForReminders
  // ─────────────────────────────────────────────────────────────
  describe('findFixedForReminders', () => {
    it('debe filtrar transacciones fijas con due_day definido y created_at acotado', async () => {
      const records = [buildRecord({ id: 7, is_fixed: true, due_day: 15 })];
      mockQb.getMany.mockResolvedValue(records);

      const from = new Date('2025-08-02');
      const result = await repo.findFixedForReminders(from);

      expect(mockQb.where).toHaveBeenCalledWith('tr.deleted_at IS NULL');
      expect(mockQb.andWhere).toHaveBeenCalledWith('tr.is_fixed = TRUE');
      expect(mockQb.andWhere).toHaveBeenCalledWith('tr.due_day IS NOT NULL');
      expect(mockQb.andWhere).toHaveBeenCalledWith('tr.created_at >= :from', {
        from,
      });
      expect(result).toEqual(records);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // getSummary
  // ─────────────────────────────────────────────────────────────
  describe('getSummary', () => {
    it('debe calcular totales, categorías y serie a partir de raw rows', async () => {
      mockQb.getRawMany
        .mockResolvedValueOnce([
          { type: 'income', amount: '1000', count: '2' },
          { type: 'expense', amount: '400', count: '3' },
        ])
        .mockResolvedValueOnce([
          { category_id: 1, type: 'expense', amount: '400', count: '3' },
        ])
        .mockResolvedValueOnce([
          { bucket: '2026-08-03', type: 'income', amount: '1000', count: '2' },
          { bucket: '2026-08-03', type: 'expense', amount: '400', count: '3' },
        ])
        .mockResolvedValueOnce([]);

      const result = await repo.getSummary(10, {
        date_from: '2026-08-01',
        date_to: '2026-08-31',
        group_by: 'day',
      });

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'tr.transaction_date >= :from',
        { from: '2026-08-01' },
      );
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'tr.transaction_date <= :to',
        { to: '2026-08-31' },
      );
      expect(mockQb.setParameter).toHaveBeenCalledWith('trunc', 'day');
      expect(result.totals).toEqual({
        income: 1000,
        expenses: 400,
        investments: 0,
        count: 5,
      });
      expect(result.by_category).toHaveLength(1);
      expect(result.by_category[0]).toMatchObject({
        category_id: 1,
        expenses: 400,
        count: 3,
      });
      expect(result.series).toHaveLength(1);
      expect(result.series[0]).toMatchObject({
        key: '2026-08-03',
        income: 1000,
        expenses: 400,
        count: 5,
      });
    });

    it('debe aplicar el filtro de tipo y el grupo semanal cuando se proveen', async () => {
      mockQb.getRawMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await repo.getSummary(10, { type: 'expense', group_by: 'week' });

      const typeCalls = (
        mockQb.andWhere.mock.calls as Array<
          [string, Record<string, unknown> | undefined]
        >
      ).filter((c) => c[0] === 'tr.type = :type');
      expect(typeCalls.length).toBeGreaterThan(0);
      expect(typeCalls[0][1]).toEqual({ type: 'expense' });
      expect(mockQb.setParameter).toHaveBeenCalledWith('trunc', 'week');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // update
  // ─────────────────────────────────────────────────────────────
  describe('update', () => {
    const dto: UpdateTransactionRecordDto = { amount: 250 };

    it('debe actualizar y retornar la transacción', async () => {
      const existing = buildRecord();
      const updated = buildRecord({ amount: 250 });
      mockTypeOrmRepo.findOne.mockResolvedValue(existing);
      mockTypeOrmRepo.merge.mockReturnValue(updated);
      mockTypeOrmRepo.save.mockResolvedValue(updated);

      const result = await repo.update(1, 10, dto);

      expect(result.amount).toBe(250);
    });

    it('debe lanzar NotFoundException si no existe', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      await expect(repo.update(999, 10, dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // softDelete
  // ─────────────────────────────────────────────────────────────
  describe('softDelete', () => {
    it('debe ejecutar softRemove sobre la transacción', async () => {
      const record = buildRecord();
      mockTypeOrmRepo.findOne.mockResolvedValue(record);
      mockTypeOrmRepo.softRemove.mockResolvedValue(undefined);

      await repo.softDelete(1, 10);

      expect(mockTypeOrmRepo.softRemove).toHaveBeenCalledWith(record);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // createMany
  // ─────────────────────────────────────────────────────────────
  describe('createMany', () => {
    it('retorna [] con lista vacía', async () => {
      await expect(repo.createMany(10, [])).resolves.toEqual([]);
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it('crea en lote y ajusta vínculos agregados', async () => {
      mockTypeOrmRepo.create.mockImplementation((e: unknown) => e);
      mockTypeOrmRepo.save.mockResolvedValue([
        buildRecord({ id: 1, objective_id: 5 }),
        buildRecord({ id: 2, account_id: 9 }),
      ]);
      mockTypeOrmRepo.findOneBy.mockResolvedValue({
        current_balance: 100,
        target_amount: 1000,
        is_completed: false,
        completed_at: null,
        // Saldo suficiente para cubrir el débito neto de -100 sobre la
        // cuenta 9 sin disparar la validación de saldo negativo.
        encrypted_balance: '500',
      });

      const dtos = [
        { amount: 100, type: 'EXPENSE' as never },
        { amount: 200, type: 'EXPENSE' as never },
      ];
      const result = await repo.createMany(10, dtos);
      expect(result).toHaveLength(2);
      expect(mockDataSource.transaction).toHaveBeenCalled();
    });

    it('sin assignCategories marca PENDING/CATEGORIZED', async () => {
      mockTypeOrmRepo.create.mockImplementation((e: unknown) => e);
      mockTypeOrmRepo.save.mockResolvedValue([]);
      const dtos = [
        { amount: 100, type: 'EXPENSE' as never, category_id: null },
        { amount: 200, type: 'EXPENSE' as never, category_id: 3 },
      ];
      await repo.createMany(10, dtos as never, { assignCategories: false });
      const created = mockTypeOrmRepo.create.mock.calls.map((c) => c[0]);
      expect(created[0].category_status).toBe('pending');
      expect(created[1].category_status).toBe('categorized');
    });

    it('con assignCategories autoprovisiona reglas para descripciones faltantes', async () => {
      mockTypeOrmRepo.create.mockImplementation((e: unknown) => e);
      mockTypeOrmRepo.save.mockResolvedValue([]);
      mockCategoryRuleRepo.find.mockResolvedValue([]);
      const dtos = [
        {
          amount: 100,
          type: 'EXPENSE' as never,
          category_id: null,
          description: 'Mercado',
        },
        {
          amount: 50,
          type: 'EXPENSE' as never,
          category_id: 2,
          description: 'Otro',
        },
      ];
      await repo.createMany(10, dtos as never, { assignCategories: true });
      expect(mockCategoryRuleRepo.find).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // fingerprint / findExistingFingerprints
  // ─────────────────────────────────────────────────────────────
  describe('fingerprint', () => {
    it('normaliza descripción y monto', () => {
      const fp = TransactionRecordRepository.fingerprint(
        '2026-08-01',
        100,
        '  Pago   de   Prueba  ',
      );
      expect(fp).toBe('2026-08-01|100|pago de prueba');
    });
  });

  describe('findExistingFingerprints', () => {
    it('retorna set vacío sin fechas', async () => {
      await expect(
        repo.findExistingFingerprints(10, [], new Date()),
      ).resolves.toEqual(new Set());
    });

    it('construye huellas desde raw rows', async () => {
      mockQb.getRawMany.mockResolvedValue([
        { transaction_date: '2026-08-01', amount: '100', description: 'Pago' },
        { transaction_date: '2026-08-02', amount: '50', description: 'Otro' },
      ]);
      const set = await repo.findExistingFingerprints(
        10,
        ['2026-08-01', '2026-08-02'],
        new Date(),
      );
      expect(set.size).toBe(2);
      expect(set.has('2026-08-01|100|pago')).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findUpcomingSubscriptions
  // ─────────────────────────────────────────────────────────────
  describe('findUpcomingSubscriptions', () => {
    it('consulta deducciones fijas con due_day y created_at', async () => {
      mockQb.getMany.mockResolvedValue([buildRecord()]);
      const result = await repo.findUpcomingSubscriptions(10, new Date());
      expect(result).toHaveLength(1);
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'tr.fixed_type = :fixedType',
        { fixedType: 'deduction' },
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // softDeleteMany
  // ─────────────────────────────────────────────────────────────
  describe('softDeleteMany', () => {
    it('retorna 0 con lista vacía', async () => {
      await expect(repo.softDeleteMany([], 10)).resolves.toBe(0);
    });

    it('lanza NotFoundException si no encuentra registros', async () => {
      mockTypeOrmRepo.find.mockResolvedValue([]);
      await expect(repo.softDeleteMany([1], 10)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('elimina registros y expande pares de transferencia', async () => {
      mockTypeOrmRepo.find.mockResolvedValueOnce([
        buildRecord({ id: 1, transfer_group_id: 'g1' }),
      ]);
      mockTypeOrmRepo.find.mockResolvedValueOnce([
        buildRecord({ id: 1, transfer_group_id: 'g1' }),
        buildRecord({ id: 2, transfer_group_id: 'g1' }),
      ]);
      mockTypeOrmRepo.softRemove.mockResolvedValue([]);
      mockTypeOrmRepo.findOneBy.mockResolvedValue({
        current_balance: 0,
        target_amount: 100,
        encrypted_balance: '0',
      });

      const count = await repo.softDeleteMany([1], 10);
      expect(count).toBe(2);
      expect(mockTypeOrmRepo.softRemove).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // createTransfer
  // ─────────────────────────────────────────────────────────────
  describe('createTransfer', () => {
    const dto = {
      source_account_id: 100,
      destination_account_id: 200,
      amount: 50000,
      transaction_date: '2026-08-01',
      description: 'Movimiento',
      reference_code: 'REF',
      objective_id: null,
    };

    it('permite origen = destino (la validación de igualdad fue removida)', async () => {
      // La restricción "TRANSFER_SAME_ACCOUNT" fue eliminada de
      // createTransfer (ver historial de transaction-record.repository.ts);
      // actualmente resuelve normalmente en vez de rechazar.
      mockTypeOrmRepo.create.mockImplementation((e: unknown) => e);
      mockTypeOrmRepo.save.mockImplementation((e: unknown) =>
        Promise.resolve({ ...(e as object), id: Math.random() }),
      );
      // createTransfer hace 4 lecturas secuenciales de la cuenta 100: (1)
      // valida existencia del origen, (2) valida existencia del destino,
      // (3) applyTransferAdjustment del leg origen (débito), (4)
      // applyTransferAdjustment del leg destino (crédito). Se encolan 4
      // snapshots independientes para que cada lectura calcule sobre su
      // propio objeto y no sobre una referencia mutada compartida.
      const freshAccount = () => ({
        id: 100,
        account_type: 'AHORROS',
        bank_name: 'Banco A',
        encrypted_balance: '100000',
      });
      mockTypeOrmRepo.findOneBy
        .mockResolvedValueOnce(freshAccount())
        .mockResolvedValueOnce(freshAccount())
        .mockResolvedValueOnce(freshAccount())
        .mockResolvedValueOnce(freshAccount());

      const [origin, destination] = await repo.createTransfer(10, {
        ...dto,
        destination_account_id: 100,
      } as never);
      expect(origin.origin_account_id).toBe(100);
      expect(destination.destination_account_id).toBe(100);

      // Verifica que el débito (leg origen) y el crédito (leg destino) se
      // aplican como dos ajustes separados sobre la MISMA cuenta
      // (applyTransferAdjustment se invoca en serie para cada leg, no en
      // paralelo). Si un futuro cambio paralelizara esas llamadas con
      // Promise.all sobre el mismo id de cuenta, este test seguiría
      // documentando el resultado esperado de cada ajuste individual.
      const accountSaves = mockTypeOrmRepo.save.mock.calls
        .map((call) => call[0] as { encrypted_balance?: string })
        .filter((s) => s.encrypted_balance !== undefined);
      expect(accountSaves).toHaveLength(2);
      expect(accountSaves[0].encrypted_balance).toBe('50000'); // débito: 100000 - 50000
      expect(accountSaves[1].encrypted_balance).toBe('150000'); // crédito: 100000 + 50000
    });

    it('lanza NotFoundException si alguna cuenta no existe', async () => {
      mockTypeOrmRepo.findOneBy.mockResolvedValue(null);
      await expect(repo.createTransfer(10, dto as never)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('crea el par origen/destino y ajusta saldos', async () => {
      mockTypeOrmRepo.create.mockImplementation((e: unknown) => e);
      mockTypeOrmRepo.save.mockImplementation((e: unknown) =>
        Promise.resolve({ ...(e as object), id: Math.random() }),
      );
      mockTypeOrmRepo.findOneBy.mockResolvedValue({
        id: 100,
        account_type: 'AHORROS',
        bank_name: 'Banco A',
        encrypted_balance: '100000',
      });

      const [origin, destination] = await repo.createTransfer(10, dto as never);
      expect(origin.origin_account_id).toBe(100);
      expect(destination.destination_account_id).toBe(200);
      expect(origin.transfer_group_id).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findTransferById / findTransfers
  // ─────────────────────────────────────────────────────────────
  describe('findTransferById', () => {
    it('lanza NotFoundException si no existe', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);
      await expect(repo.findTransferById(1, 10)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('retorna solo el registro si no tiene transfer_group_id', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(
        buildRecord({ transfer_group_id: null }),
      );
      const result = await repo.findTransferById(1, 10);
      expect(result).toHaveLength(1);
    });

    it('retorna los hermanos del grupo', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(
        buildRecord({ transfer_group_id: 'g1' }),
      );
      mockTypeOrmRepo.find.mockResolvedValue([
        buildRecord({ id: 1, transfer_group_id: 'g1' }),
        buildRecord({ id: 2, transfer_group_id: 'g1' }),
      ]);
      const result = await repo.findTransferById(1, 10);
      expect(result).toHaveLength(2);
    });
  });

  describe('findTransfers', () => {
    it('paginación básica', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[buildRecord()], 1]);
      const result = await repo.findTransfers(10);
      expect(result.total).toBe(1);
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'tr.transfer_group_id IS NOT NULL',
      );
    });

    it('limita el page size a 500', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);
      await repo.findTransfers(10, 1, 1000);
      expect(mockQb.take).toHaveBeenCalledWith(500);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // updateTransfer / softDeleteTransfer
  // ─────────────────────────────────────────────────────────────
  describe('updateTransfer', () => {
    it('actualiza campos y re-aplica ajustes', async () => {
      const record = buildRecord({
        transfer_group_id: 'g1',
        origin_account_id: 100,
        destination_account_id: 200,
        amount: 50000,
      });
      mockTypeOrmRepo.findOne.mockResolvedValue(record);
      mockTypeOrmRepo.find.mockResolvedValue([
        record,
        buildRecord({
          id: 2,
          transfer_group_id: 'g1',
          origin_account_id: null,
          destination_account_id: 200,
          amount: 50000,
        }),
      ]);
      mockTypeOrmRepo.merge.mockImplementation(
        (old: object, fields: object) => ({
          ...old,
          ...fields,
        }),
      );
      mockTypeOrmRepo.save.mockImplementation((e: object) =>
        Promise.resolve(e),
      );
      mockTypeOrmRepo.findOneBy.mockResolvedValue({
        // Saldo suficiente para soportar el débito/crédito de revertir
        // (-1) y re-aplicar (+1) el monto (50000 -> 60000) sin disparar
        // la validación de saldo negativo.
        encrypted_balance: '1000000',
        current_balance: 0,
        target_amount: 1000,
      });

      const result = await repo.updateTransfer(1, 10, {
        amount: 60000,
        description: 'Nuevo',
      });
      expect(result).toHaveLength(2);
    });
  });

  describe('softDeleteTransfer', () => {
    it('revierte saldos y hace softRemove de ambos movimientos', async () => {
      const record = buildRecord({
        transfer_group_id: 'g1',
        origin_account_id: 100,
        destination_account_id: 200,
        amount: 50000,
      });
      mockTypeOrmRepo.findOne.mockResolvedValue(record);
      mockTypeOrmRepo.find.mockResolvedValue([
        record,
        buildRecord({ id: 2, transfer_group_id: 'g1' }),
      ]);
      mockTypeOrmRepo.softRemove.mockResolvedValue([]);
      mockTypeOrmRepo.findOneBy.mockResolvedValue({
        encrypted_balance: '0',
        current_balance: 0,
        target_amount: 1000,
      });

      await repo.softDeleteTransfer(1, 10);
      expect(mockTypeOrmRepo.softRemove).toHaveBeenCalledTimes(2);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findAll: ramas faltantes (filtros de estado y vínculos)
  // ─────────────────────────────────────────────────────────────
  describe('findAll - filtros de estado y vínculos', () => {
    it('debe aplicar category_status, uncategorized y todos los vínculos', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[buildRecord()], 1]);

      await repo.findAll(10, {
        page: 1,
        limit: 20,
        category_status: ReviewStatusEnum.PENDING,
        uncategorized: true,
        objective_id: 1,
        account_id: 2,
        asset_id: 3,
        liability_id: 4,
      });

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'tr.category_status = :category_status',
        { category_status: ReviewStatusEnum.PENDING },
      );
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'tr.category_status = :pendingStatus',
        { pendingStatus: ReviewStatusEnum.PENDING },
      );
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'tr.objective_id = :objective_id',
        { objective_id: 1 },
      );
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'tr.account_id = :account_id',
        {
          account_id: 2,
        },
      );
      expect(mockQb.andWhere).toHaveBeenCalledWith('tr.asset_id = :asset_id', {
        asset_id: 3,
      });
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'tr.liability_id = :liability_id',
        { liability_id: 4 },
      );
    });

    it('no aplica el filtro uncategorized si no es true estricto', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);

      await repo.findAll(10, { uncategorized: false });

      const pendingCalls = (
        mockQb.andWhere.mock.calls as Array<[string, unknown]>
      ).filter((c) => c[0] === 'tr.category_status = :pendingStatus');
      expect(pendingCalls).toHaveLength(0);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // update: auto-categorización y aprendizaje de reglas
  // ─────────────────────────────────────────────────────────────
  describe('update - reglas y propagación', () => {
    it('con categoría y descripción aprende la regla y propaga a similares', async () => {
      const existing = buildRecord({
        category_id: null,
        description: 'Mercado',
      });
      const updated = buildRecord({
        amount: 250,
        category_id: 5,
        description: 'Mercado',
      });
      mockTypeOrmRepo.findOne.mockResolvedValue(existing);
      mockTypeOrmRepo.merge.mockReturnValue(updated);
      mockTypeOrmRepo.save.mockResolvedValue(updated);
      mockQb.execute.mockResolvedValue({ affected: 3 });

      const result = await repo.update(1, 10, {
        amount: 250,
        category_id: 5,
        subcategory_id: 7,
        description: 'Mercado',
        apply_to_similar: true,
      });

      expect(mockCategoryRuleRepo.upsert).toHaveBeenCalledWith(
        {
          user_id: 10,
          normalized_description: 'mercado',
          category_id: 5,
          subcategory_id: 7,
        },
        ['user_id', 'normalized_description'],
      );
      expect(mockQb.update).toHaveBeenCalledWith(TransactionRecord);
      expect(mockQb.execute).toHaveBeenCalled();
      expect(result.amount).toBe(250);
    });

    it('aprende la regla sin propagar si apply_to_similar no es true', async () => {
      const existing = buildRecord({
        category_id: null,
        description: 'Mercado',
      });
      const updated = buildRecord({
        amount: 250,
        category_id: 5,
        description: 'Mercado',
      });
      mockTypeOrmRepo.findOne.mockResolvedValue(existing);
      mockTypeOrmRepo.merge.mockReturnValue(updated);
      mockTypeOrmRepo.save.mockResolvedValue(updated);

      await repo.update(1, 10, {
        category_id: 5,
        description: 'Mercado',
        apply_to_similar: false,
      });

      expect(mockCategoryRuleRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ normalized_description: 'mercado' }),
        ['user_id', 'normalized_description'],
      );
      expect(mockQb.execute).not.toHaveBeenCalled();
    });

    it('descripción en blanco no aprende regla ni propaga', async () => {
      const existing = buildRecord({ category_id: null, description: '   ' });
      const updated = buildRecord({
        amount: 250,
        category_id: 5,
        description: '   ',
      });
      mockTypeOrmRepo.findOne.mockResolvedValue(existing);
      mockTypeOrmRepo.merge.mockReturnValue(updated);
      mockTypeOrmRepo.save.mockResolvedValue(updated);

      await repo.update(1, 10, {
        category_id: 5,
        description: '   ',
        apply_to_similar: true,
      });

      expect(mockCategoryRuleRepo.upsert).not.toHaveBeenCalled();
      expect(mockQb.execute).not.toHaveBeenCalled();
    });

    it('sin categoría auto-categoriza por regla aprendida de la descripción', async () => {
      const existing = buildRecord({
        category_id: null,
        description: 'Servicio',
      });
      const updated = buildRecord({ description: 'Servicio' });
      mockTypeOrmRepo.findOne.mockResolvedValue(existing);
      mockTypeOrmRepo.merge.mockReturnValue(updated);
      mockTypeOrmRepo.save.mockResolvedValue(updated);
      mockCategoryRuleRepo.findOne.mockResolvedValue({
        category_id: 9,
        subcategory_id: null,
      });

      const result = await repo.update(1, 10, {
        description: 'Servicio',
      });

      expect(mockCategoryRuleRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { user_id: 10, normalized_description: 'servicio' },
        }),
      );
      expect(result.category_id).toBe(9);
      expect(result.category_status).toBe(ReviewStatusEnum.CATEGORIZED);
    });

    it('sin cambio neto en vínculos no ajusta saldos', async () => {
      const old = buildRecord({ amount: 100, type: 'expense', account_id: 1 });
      const updated = buildRecord({
        amount: 100,
        type: 'expense',
        account_id: 1,
      });
      mockTypeOrmRepo.findOne.mockResolvedValue(old);
      mockTypeOrmRepo.merge.mockReturnValue(updated);
      mockTypeOrmRepo.save.mockResolvedValue(updated);

      await repo.update(1, 10, { amount: 100 });

      expect(mockTypeOrmRepo.findOneBy).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // create: reglas de auto-categorización
  // ─────────────────────────────────────────────────────────────
  describe('create - auto-categorización y reglas', () => {
    it('sin categoría se auto-categoriza por regla de descripción', async () => {
      const saved = buildRecord({ description: 'Mercado' });
      mockTypeOrmRepo.create.mockReturnValue(saved);
      mockTypeOrmRepo.save.mockResolvedValue(saved);
      mockCategoryRuleRepo.findOne.mockResolvedValue({
        category_id: 4,
        subcategory_id: 2,
      });

      const result = await repo.create(10, {
        amount: 50,
        type: 'EXPENSE' as never,
        description: 'Mercado',
      });

      expect(result.category_id).toBe(4);
      expect(result.category_status).toBe(ReviewStatusEnum.CATEGORIZED);
      expect(mockCategoryRuleRepo.upsert).not.toHaveBeenCalled();
    });

    it('sin descripción queda pendiente por editar', async () => {
      const saved = buildRecord({ description: '' });
      mockTypeOrmRepo.create.mockReturnValue(saved);
      mockTypeOrmRepo.save.mockResolvedValue(saved);
      mockCategoryRuleRepo.findOne.mockResolvedValue(null);

      const result = await repo.create(10, {
        amount: 50,
        type: 'EXPENSE' as never,
      });

      expect(result.category_id).toBeNull();
      expect(result.category_status).toBe(ReviewStatusEnum.PENDING);
    });

    it('con categoría aprende la regla por descripción', async () => {
      const saved = buildRecord({ description: '   Compras   ' });
      mockTypeOrmRepo.create.mockReturnValue(saved);
      mockTypeOrmRepo.save.mockResolvedValue(saved);

      await repo.create(10, {
        amount: 50,
        type: 'EXPENSE' as never,
        category_id: 2,
        subcategory_id: 3,
      });

      expect(mockCategoryRuleRepo.upsert).toHaveBeenCalledWith(
        {
          user_id: 10,
          normalized_description: 'compras',
          category_id: 2,
          subcategory_id: 3,
        },
        ['user_id', 'normalized_description'],
      );
    });

    it('ignora vínculos inexistentes', async () => {
      const saved = buildRecord({
        type: 'expense',
        objective_id: 5,
        account_id: 1,
        asset_id: 2,
        liability_id: 4,
      });
      mockTypeOrmRepo.create.mockReturnValue(saved);
      mockTypeOrmRepo.save.mockResolvedValue(saved);
      mockTypeOrmRepo.findOneBy.mockResolvedValue(null);

      await repo.create(10, {
        amount: 100,
        type: 'EXPENSE' as never,
        category_id: 1,
        objective_id: 5,
        account_id: 1,
        asset_id: 2,
        liability_id: 4,
      });

      expect(mockTypeOrmRepo.findOneBy).toHaveBeenCalledTimes(4);
    });

    it('saldo cifrado vacío se trata como cero', async () => {
      const saved = buildRecord({ type: 'income', account_id: 1 });
      mockTypeOrmRepo.create.mockReturnValue(saved);
      mockTypeOrmRepo.save.mockResolvedValue(saved);
      mockTypeOrmRepo.findOneBy.mockResolvedValue({
        id: 1,
        encrypted_balance: '',
      });

      await repo.create(10, {
        amount: 100,
        type: 'income' as never,
        category_id: 1,
        account_id: 1,
      });

      const accountSave = mockTypeOrmRepo.save.mock.calls.find(
        (call) => call[0]?.encrypted_balance !== undefined && call[0]?.id === 1,
      );
      expect(accountSave).toBeDefined();
      expect(accountSave![0].encrypted_balance).toBe('100');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // softDelete: transferencias
  // ─────────────────────────────────────────────────────────────
  describe('softDelete - miembro de transferencia', () => {
    it('delega en softDeleteTransfer si pertenece a un grupo', async () => {
      const record = buildRecord({ transfer_group_id: 'g1' });
      mockTypeOrmRepo.findOne.mockResolvedValue(record);
      mockTypeOrmRepo.find.mockResolvedValue([
        record,
        buildRecord({ id: 2, transfer_group_id: 'g1' }),
      ]);
      mockTypeOrmRepo.softRemove.mockResolvedValue([]);

      await repo.softDelete(1, 10);

      expect(mockTypeOrmRepo.softRemove).toHaveBeenCalledTimes(2);
      expect(mockTypeOrmRepo.softRemove).toHaveBeenCalledWith(record);
      expect(mockTypeOrmRepo.softRemove).toHaveBeenCalledWith(
        expect.objectContaining({ id: 2, transfer_group_id: 'g1' }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // softDeleteMany: deltas cero y saldos de meta/activo/pasivo
  // ─────────────────────────────────────────────────────────────
  describe('softDeleteMany - saldos agregados', () => {
    it('omite deltas cero (contribuciones que se cancelan)', async () => {
      mockTypeOrmRepo.find.mockResolvedValueOnce([
        buildRecord({ id: 1, type: 'expense', amount: 100, account_id: 1 }),
        buildRecord({ id: 2, type: 'income', amount: 100, account_id: 1 }),
      ]);
      mockTypeOrmRepo.softRemove.mockResolvedValue([]);

      const count = await repo.softDeleteMany([1, 2], 10);

      expect(count).toBe(2);
      expect(mockTypeOrmRepo.findOneBy).not.toHaveBeenCalled();
    });

    it('ajusta meta, activo y pasivo con saldos iniciales ausentes', async () => {
      mockTypeOrmRepo.find.mockResolvedValueOnce([
        buildRecord({ id: 1, type: 'expense', amount: 100, objective_id: 5 }),
        buildRecord({ id: 2, type: 'investment', amount: 50, asset_id: 6 }),
        buildRecord({ id: 3, type: 'expense', amount: 200, liability_id: 7 }),
      ]);
      mockTypeOrmRepo.softRemove.mockResolvedValue([]);
      mockTypeOrmRepo.findOneBy.mockImplementation((c: { id?: number }) =>
        Promise.resolve({ id: c?.id }),
      );

      const count = await repo.softDeleteMany([1, 2, 3], 10);

      expect(count).toBe(3);
      const saves = mockTypeOrmRepo.save.mock.calls.map((call) => call[0]);
      expect(saves.find((s) => s?.id === 5)?.current_balance).toBe(100);
      expect(saves.find((s) => s?.id === 6)?.current_value).toBe(-50);
      expect(saves.find((s) => s?.id === 7)?.current_balance).toBe(200);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // createTransfer: valores por defecto y meta vinculada
  // ─────────────────────────────────────────────────────────────
  describe('createTransfer - ramas restantes', () => {
    const dto = {
      source_account_id: 100,
      destination_account_id: 200,
      amount: 50000,
      transaction_date: '2026-08-01',
      description: 'Movimiento',
      reference_code: 'REF',
      objective_id: null,
    };

    it('usa valores por defecto para fecha y descripción', async () => {
      mockTypeOrmRepo.create.mockImplementation((e: unknown) => e);
      mockTypeOrmRepo.save.mockImplementation((e: unknown) =>
        Promise.resolve({ ...(e as object), id: Math.random() }),
      );
      mockTypeOrmRepo.findOneBy.mockResolvedValue({
        id: 100,
        account_type: 'AHORROS',
        bank_name: 'Banco A',
        // Saldo suficiente para cubrir el débito del monto (10) sin
        // disparar la validación de saldo negativo.
        encrypted_balance: '1000000',
      });

      const [origin] = await repo.createTransfer(10, {
        source_account_id: 100,
        destination_account_id: 200,
        amount: 10,
      });

      expect(origin.description).toBe('Movimiento entre cuentas');
      expect(String(origin.transaction_date)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('lanza NotFoundException si falta solo el destino', async () => {
      mockTypeOrmRepo.findOneBy
        .mockResolvedValueOnce({
          id: 100,
          account_type: 'AHORROS',
          bank_name: 'Banco A',
          encrypted_balance: '0',
        })
        .mockResolvedValueOnce(null);

      await expect(repo.createTransfer(10, dto as never)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('ajusta la meta vinculada del registro destino', async () => {
      mockTypeOrmRepo.create.mockImplementation((e: unknown) => e);
      mockTypeOrmRepo.save.mockImplementation((e: unknown) =>
        Promise.resolve({ ...(e as object), id: Math.random() }),
      );
      mockTypeOrmRepo.findOneBy.mockImplementation((c: { id?: number }) =>
        Promise.resolve({
          id: c?.id,
          account_type: 'AHORROS',
          bank_name: 'Banco A',
          encrypted_balance: '100000',
          current_balance: 1000,
          target_amount: 5000,
        }),
      );

      const [, destination] = await repo.createTransfer(10, {
        ...dto,
        objective_id: 3,
      });

      expect(destination.objective_id).toBe(3);
      const objectiveSave = mockTypeOrmRepo.save.mock.calls.find(
        (call) => call[0]?.id === 3,
      );
      expect(objectiveSave).toBeDefined();
      expect(objectiveSave![0].current_balance).toBe(51000);
      const destinationSave = mockTypeOrmRepo.save.mock.calls.find(
        (call) => call[0]?.id === 200,
      );
      expect(destinationSave).toBeDefined();
      expect(destinationSave![0].encrypted_balance).toBe('150000');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // updateTransfer: campos completos y objective_id
  // ─────────────────────────────────────────────────────────────
  describe('updateTransfer - ramas restantes', () => {
    const stubRepo = () => {
      mockTypeOrmRepo.merge.mockImplementation(
        (old: object, fields: object) => ({ ...old, ...fields }),
      );
      mockTypeOrmRepo.save.mockImplementation((e: object) =>
        Promise.resolve(e),
      );
      mockTypeOrmRepo.findOneBy.mockImplementation((c: { id?: number }) =>
        Promise.resolve({
          id: c?.id,
          // Saldo suficiente para soportar el revert (-1) y el re-apply
          // (+1) del monto actualizado sin disparar saldo negativo.
          encrypted_balance: '1000000',
          current_balance: 0,
          target_amount: 1000,
        }),
      );
    };

    it('actualiza fecha, descripción, referencia y meta vinculada', async () => {
      const record = buildRecord({
        transfer_group_id: 'g1',
        origin_account_id: 100,
        destination_account_id: 200,
        amount: 50000,
        objective_id: null,
      });
      mockTypeOrmRepo.findOne.mockResolvedValue(record);
      mockTypeOrmRepo.find.mockResolvedValue([
        record,
        buildRecord({
          id: 2,
          transfer_group_id: 'g1',
          origin_account_id: null,
          destination_account_id: 200,
          amount: 50000,
          objective_id: null,
        }),
      ]);
      stubRepo();

      const result = await repo.updateTransfer(1, 10, {
        amount: 60000,
        transaction_date: '2026-08-10',
        description: 'Nuevo',
        reference_code: 'REF2',
        objective_id: 3,
      });

      expect(result).toHaveLength(2);
      const mergedSaves = mockTypeOrmRepo.save.mock.calls
        .map((call) => call[0])
        .filter((s) => s?.description === 'Nuevo');
      expect(mergedSaves).toHaveLength(2);
      expect(mergedSaves[0].amount).toBe(60000);
      expect(mergedSaves[0].transaction_date).toBe('2026-08-10');
      expect(mergedSaves[0].reference_code).toBe('REF2');
      expect(mergedSaves[0].objective_id).toBe(3);
    });

    it('objective_id null limpia la meta del registro destino', async () => {
      const record = buildRecord({
        transfer_group_id: 'g1',
        origin_account_id: 100,
        destination_account_id: 200,
        amount: 50000,
        objective_id: 3,
      });
      mockTypeOrmRepo.findOne.mockResolvedValue(record);
      mockTypeOrmRepo.find.mockResolvedValue([record]);
      stubRepo();

      await repo.updateTransfer(1, 10, { objective_id: null } as never);

      const mergedSave = mockTypeOrmRepo.save.mock.calls
        .map((call) => call[0])
        .find((s) => s?.id === 1);
      expect(mergedSave?.objective_id).toBeNull();
    });

    it('no asigna objective_id si el registro no es el destino', async () => {
      const record = buildRecord({
        transfer_group_id: 'g1',
        origin_account_id: 100,
        destination_account_id: null,
        amount: 50000,
      });
      mockTypeOrmRepo.findOne.mockResolvedValue(record);
      mockTypeOrmRepo.find.mockResolvedValue([record]);
      stubRepo();

      await repo.updateTransfer(1, 10, { objective_id: 3 });

      const mergedSave = mockTypeOrmRepo.save.mock.calls
        .map((call) => call[0])
        .find((s) => s?.id === 1);
      expect(mergedSave?.objective_id).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // collectContributions: transferencias en lote
  // ─────────────────────────────────────────────────────────────
  describe('createMany - transferencias y deltas cero', () => {
    it('no ajusta cuentas origen/destino (createMany solo procesa vínculos genéricos)', async () => {
      // NOTA: collectContributions (usado por createMany) itera LINK_KINDS
      // ['objective','account','asset','liability'] leyendo tx.account_id /
      // tx.asset_id / tx.liability_id / tx.objective_id — NO tx.origin_
      // account_id / tx.destination_account_id. Esos campos solo son
      // ajustados por applyTransferAdjustment, usado exclusivamente por
      // createTransfer/updateTransfer/cloneTransfer/softDeleteTransfer.
      // CreateTransactionRecordDto tampoco expone origin/destination_
      // account_id, así que este escenario no es alcanzable desde la API
      // pública hoy; por eso createMany no ajusta ningún saldo aquí.
      mockTypeOrmRepo.create.mockImplementation((e: unknown) => e);
      mockTypeOrmRepo.save.mockResolvedValue([
        buildRecord({
          id: 1,
          type: 'transfer',
          amount: 100,
          origin_account_id: 7,
          destination_account_id: 8,
        }),
        buildRecord({
          id: 2,
          type: 'transfer',
          amount: 50,
          origin_account_id: null,
          destination_account_id: 9,
        }),
        buildRecord({
          id: 3,
          type: 'transfer',
          amount: 30,
          origin_account_id: 10,
          destination_account_id: null,
        }),
      ]);
      mockTypeOrmRepo.findOneBy.mockImplementation((c: { id?: number }) =>
        Promise.resolve({ id: c?.id, encrypted_balance: '100' }),
      );

      await repo.createMany(
        10,
        [
          { amount: 100, type: 'transfer' as never },
          { amount: 50, type: 'transfer' as never },
          { amount: 30, type: 'transfer' as never },
        ] as never,
        { assignCategories: false },
      );

      const accountSaves = mockTypeOrmRepo.save.mock.calls
        .map((call) => call[0])
        .filter((s) => s?.encrypted_balance !== undefined);
      expect(accountSaves).toHaveLength(0);
      expect(mockTypeOrmRepo.findOneBy).not.toHaveBeenCalled();
    });

    it('omite deltas cero al ajustar vínculos', async () => {
      mockTypeOrmRepo.create.mockImplementation((e: unknown) => e);
      mockTypeOrmRepo.save.mockResolvedValue([
        buildRecord({ id: 1, type: 'expense', amount: 100, account_id: 1 }),
        buildRecord({ id: 2, type: 'income', amount: 100, account_id: 1 }),
      ]);

      await repo.createMany(
        10,
        [
          { amount: 100, type: 'expense' as never },
          { amount: 100, type: 'income' as never },
        ] as never,
        { assignCategories: false },
      );

      expect(mockTypeOrmRepo.findOneBy).not.toHaveBeenCalled();
    });

    it('aplica reglas pre-cargadas de auto-categorización', async () => {
      mockTypeOrmRepo.create.mockImplementation((e: unknown) => e);
      mockTypeOrmRepo.save.mockResolvedValue([]);
      mockCategoryRuleRepo.find.mockResolvedValue([
        {
          normalized_description: 'mercado',
          category_id: 4,
          subcategory_id: 2,
        },
      ]);

      await repo.createMany(
        10,
        [
          {
            amount: 100,
            type: 'EXPENSE' as never,
            category_id: null,
            description: 'Mercado',
          },
        ] as never,
        { assignCategories: true },
      );

      const created = mockTypeOrmRepo.create.mock.calls.map((c) => c[0]);
      expect(created[0].category_id).toBe(4);
      expect(created[0].subcategory_id).toBe(2);
      expect(created[0].category_status).toBe(ReviewStatusEnum.CATEGORIZED);
    });

    it('sin descripciones no consulta reglas y marca PENDING', async () => {
      mockTypeOrmRepo.create.mockImplementation((e: unknown) => e);
      mockTypeOrmRepo.save.mockResolvedValue([]);

      await repo.createMany(
        10,
        [
          {
            amount: 100,
            type: 'EXPENSE' as never,
            category_id: null,
            description: '',
          },
        ] as never,
        { assignCategories: true },
      );

      const created = mockTypeOrmRepo.create.mock.calls.map((c) => c[0]);
      expect(created[0].category_status).toBe(ReviewStatusEnum.PENDING);
      expect(mockCategoryRuleRepo.find).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findExistingFingerprints: descripción nula
  // ─────────────────────────────────────────────────────────────
  describe('findExistingFingerprints - descripción nula', () => {
    it('maneja descripciones nulas en las filas crudas', async () => {
      mockQb.getRawMany.mockResolvedValue([
        { transaction_date: '2026-08-01', amount: '100', description: null },
      ]);

      const set = await repo.findExistingFingerprints(
        10,
        ['2026-08-01'],
        new Date(),
      );

      expect(set.has('2026-08-01|100|')).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // getSummary: ramas restantes
  // ─────────────────────────────────────────────────────────────
  describe('getSummary - ramas restantes', () => {
    it('contabiliza inversiones y excluye transferencias', async () => {
      mockQb.getRawMany
        .mockResolvedValueOnce([
          { type: 'investment', amount: '500', count: '1' },
          { type: 'transfer', amount: '999', count: '1' },
          { type: 'expense', amount: '10', count: '1' },
        ])
        .mockResolvedValueOnce([
          { category_id: 2, type: 'investment', amount: '500', count: '1' },
          { category_id: 2, type: 'transfer', amount: '999', count: '1' },
        ])
        .mockResolvedValueOnce([
          {
            bucket: '2026-08-03',
            type: 'investment',
            amount: '500',
            count: '1',
          },
          { bucket: '2026-08-03', type: 'transfer', amount: '999', count: '1' },
        ])
        .mockResolvedValueOnce([]);

      const result = await repo.getSummary(10, {
        date_from: '2026-08-01',
        date_to: '2026-08-31',
      });

      expect(result.totals.investments).toBe(500);
      expect(result.totals.count).toBe(2);
      expect(result.by_category).toHaveLength(1);
      expect(result.by_category[0].investments).toBe(500);
      expect(result.series).toHaveLength(1);
      expect(result.series[0].investments).toBe(500);
    });

    it('ordena categorías por gastos y luego por ingresos', async () => {
      mockQb.getRawMany
        .mockResolvedValueOnce([{ type: 'expense', amount: '10', count: '1' }])
        .mockResolvedValueOnce([
          { category_id: 1, type: 'expense', amount: '400', count: '1' },
          { category_id: 2, type: 'expense', amount: '400', count: '1' },
          { category_id: 3, type: 'expense', amount: '100', count: '1' },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await repo.getSummary(10, {
        date_from: '2026-08-01',
        date_to: '2026-08-31',
      });

      const ids = result.by_category.map((c) => c.category_id);
      expect(ids).toContain(1);
      expect(ids).toContain(2);
      expect(ids[2]).toBe(3);
    });

    it('formatea etiquetas por semana', async () => {
      mockQb.getRawMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            bucket: new Date(2026, 7, 3),
            type: 'income',
            amount: '10',
            count: '1',
          },
        ])
        .mockResolvedValueOnce([]);

      const result = await repo.getSummary(10, { group_by: 'week' });

      expect(result.series).toHaveLength(1);
      expect(result.series[0].key).toBe('2026-08-03');
      expect(result.series[0].label).toBeTruthy();
    });

    it('formatea etiquetas por mes', async () => {
      mockQb.getRawMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { bucket: '2026-08-03', type: 'income', amount: '10', count: '1' },
        ])
        .mockResolvedValueOnce([]);

      const result = await repo.getSummary(10, { group_by: 'month' });

      expect(result.series).toHaveLength(1);
      expect(result.series[0].label).toBeTruthy();
    });

    it('usa rangos por defecto y devuelve la clave cruda si el bucket no es fecha', async () => {
      mockQb.getRawMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { bucket: 'sin-fecha', type: 'income', amount: '10', count: '1' },
        ])
        .mockResolvedValueOnce([]);

      const result = await repo.getSummary(10, {});

      expect(result.date_from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result.date_to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result.series[0].key).toBe('sin-fecha');
      expect(result.series[0].label).toBe('sin-fecha');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Bordes finales: nulos, tipos desconocidos y valores por defecto
  // ─────────────────────────────────────────────────────────────
  describe('ramas de borde', () => {
    it('fingerprint normaliza descripciones nulas', () => {
      const fp = TransactionRecordRepository.fingerprint(
        '2026-08-01',
        100,
        null as unknown as string,
      );
      expect(fp).toBe('2026-08-01|100|');
    });

    it('createMany trata montos nulos como cero', async () => {
      mockTypeOrmRepo.create.mockImplementation((e: unknown) => e);
      mockTypeOrmRepo.save.mockResolvedValue([
        buildRecord({ id: 1, type: 'expense', amount: null, objective_id: 5 }),
      ]);
      mockTypeOrmRepo.softRemove.mockResolvedValue([]);
      mockTypeOrmRepo.findOneBy.mockResolvedValue({ id: 5 });

      await repo.createMany(
        10,
        [{ amount: null, type: 'expense' as never }] as never,
        { assignCategories: false },
      );

      expect(mockTypeOrmRepo.findOneBy).not.toHaveBeenCalled();
    });

    it('softDeleteTransfer con monto nulo no altera saldos', async () => {
      const record = buildRecord({
        transfer_group_id: 'g1',
        origin_account_id: 100,
        destination_account_id: null,
        amount: null,
      });
      mockTypeOrmRepo.findOne.mockResolvedValue(record);
      mockTypeOrmRepo.find.mockResolvedValue([record]);
      mockTypeOrmRepo.softRemove.mockResolvedValue([]);
      mockTypeOrmRepo.findOneBy.mockResolvedValue({
        id: 100,
        encrypted_balance: '100',
      });

      await repo.softDeleteTransfer(1, 10);

      expect(mockTypeOrmRepo.softRemove).toHaveBeenCalledTimes(1);
      const accountSave = mockTypeOrmRepo.save.mock.calls.find(
        (call) => call[0]?.id === 100,
      );
      expect(accountSave![0].encrypted_balance).toBe('100');
    });

    it('aprende regla sin subcategoría (usa null)', async () => {
      const saved = buildRecord({ description: 'Otro' });
      mockTypeOrmRepo.create.mockReturnValue(saved);
      mockTypeOrmRepo.save.mockResolvedValue(saved);

      await repo.create(10, {
        amount: 50,
        type: 'expense' as never,
        category_id: 2,
      });

      expect(mockCategoryRuleRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          normalized_description: 'otro',
          category_id: 2,
          subcategory_id: null,
        }),
        ['user_id', 'normalized_description'],
      );
    });

    it('update propaga con subcategoría nula', async () => {
      const existing = buildRecord({
        category_id: null,
        description: 'Mercado',
      });
      const updated = buildRecord({ category_id: 5, description: 'Mercado' });
      mockTypeOrmRepo.findOne.mockResolvedValue(existing);
      mockTypeOrmRepo.merge.mockReturnValue(updated);
      mockTypeOrmRepo.save.mockResolvedValue(updated);
      mockQb.execute.mockResolvedValue({ affected: 1 });

      await repo.update(1, 10, {
        category_id: 5,
        description: 'Mercado',
        apply_to_similar: true,
      });

      expect(mockQb.set).toHaveBeenCalledWith(
        expect.objectContaining({ subcategory_id: null }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // getSummary: filas crudas incompletas y tipos desconocidos
  // ─────────────────────────────────────────────────────────────
  describe('getSummary - filas incompletas', () => {
    it('maneja filas sin amount ni count', async () => {
      mockQb.getRawMany
        .mockResolvedValueOnce([{ type: 'expense' }])
        .mockResolvedValueOnce([{ category_id: 1, type: 'expense' }])
        .mockResolvedValueOnce([{ bucket: '2026-08-03', type: 'expense' }])
        .mockResolvedValueOnce([]);

      const result = await repo.getSummary(10, {
        date_from: '2026-08-01',
        date_to: '2026-08-31',
      });

      expect(result.totals).toEqual({
        income: 0,
        expenses: 0,
        investments: 0,
        count: 0,
      });
      expect(result.by_category[0].count).toBe(0);
      expect(result.series[0].count).toBe(0);
    });

    it('ignora tipos desconocidos en totales, categorías y serie', async () => {
      mockQb.getRawMany
        .mockResolvedValueOnce([{ type: 'foo', amount: '5', count: '1' }])
        .mockResolvedValueOnce([
          { category_id: 1, type: 'foo', amount: '5', count: '1' },
        ])
        .mockResolvedValueOnce([
          { bucket: '2026-08-03', type: 'foo', amount: '5', count: '1' },
        ])
        .mockResolvedValueOnce([]);

      const result = await repo.getSummary(10, {
        date_from: '2026-08-01',
        date_to: '2026-08-31',
      });

      expect(result.totals).toEqual({
        income: 0,
        expenses: 0,
        investments: 0,
        count: 1,
      });
      expect(result.by_category[0].expenses).toBe(0);
      expect(result.series[0].expenses).toBe(0);
    });

    it('contabiliza ingresos por categoría', async () => {
      mockQb.getRawMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { category_id: 1, type: 'income', amount: '300', count: '1' },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await repo.getSummary(10, {
        date_from: '2026-08-01',
        date_to: '2026-08-31',
      });

      expect(result.by_category[0].income).toBe(300);
    });

    it('maneja buckets nulos en la serie', async () => {
      mockQb.getRawMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { bucket: null, type: 'income', amount: '10', count: '1' },
        ])
        .mockResolvedValueOnce([]);

      const result = await repo.getSummary(10, {
        date_from: '2026-08-01',
        date_to: '2026-08-31',
      });

      expect(result.series[0].key).toBe('');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // create / createMany / update: categoría por defecto de empresa
  // ─────────────────────────────────────────────────────────────
  describe('categoría por defecto de empresa', () => {
    it('create: usa la categoría por defecto de la empresa si no hay categoría', async () => {
      const saved = buildRecord({ description: '', company_id: 5 });
      mockTypeOrmRepo.create.mockReturnValue(saved);
      mockTypeOrmRepo.save.mockResolvedValue(saved);
      mockCategoryRuleRepo.findOne.mockResolvedValue(null);
      mockEmpresaRepo.find.mockResolvedValue([]);
      const empresaFindOne = jest
        .fn()
        .mockResolvedValue({ default_category_id: 9 });
      mockManager.getRepository.mockImplementation((entity: unknown) => {
        if (entity === TransactionRecord) return mockTypeOrmRepo;
        if (entity === TransactionCategoryRule) return mockCategoryRuleRepo;
        const name = (entity as { name?: string } | null)?.name;
        if (name === 'Empresa') return { findOne: empresaFindOne };
        return linkedRepos.get(name ?? '') ?? mockTypeOrmRepo;
      });

      const result = await repo.create(10, {
        amount: 50,
        type: 'EXPENSE' as never,
        company_id: 5,
      });

      expect(empresaFindOne).toHaveBeenCalled();
      expect(result.category_id).toBe(9);
      expect(result.category_status).toBe(ReviewStatusEnum.CATEGORIZED);
    });

    it('create: no asigna categoría si la empresa no tiene una por defecto', async () => {
      const saved = buildRecord({ description: '', company_id: 5 });
      mockTypeOrmRepo.create.mockReturnValue(saved);
      mockTypeOrmRepo.save.mockResolvedValue(saved);
      mockCategoryRuleRepo.findOne.mockResolvedValue(null);
      const empresaFindOne = jest
        .fn()
        .mockResolvedValue({ default_category_id: null });
      mockManager.getRepository.mockImplementation((entity: unknown) => {
        if (entity === TransactionRecord) return mockTypeOrmRepo;
        if (entity === TransactionCategoryRule) return mockCategoryRuleRepo;
        const name = (entity as { name?: string } | null)?.name;
        if (name === 'Empresa') return { findOne: empresaFindOne };
        return linkedRepos.get(name ?? '') ?? mockTypeOrmRepo;
      });

      const result = await repo.create(10, {
        amount: 50,
        type: 'EXPENSE' as never,
        company_id: 5,
      });

      expect(result.category_id).toBeNull();
    });

    it('createMany: aplica la categoría por defecto de la empresa a registros sin categoría', async () => {
      mockTypeOrmRepo.create.mockImplementation((e: unknown) => e);
      mockTypeOrmRepo.save.mockResolvedValue([]);
      const empresaFindOne = jest
        .fn()
        .mockResolvedValue({ default_category_id: 7 });
      mockManager.getRepository.mockImplementation((entity: unknown) => {
        if (entity === TransactionRecord) return mockTypeOrmRepo;
        if (entity === TransactionCategoryRule) return mockCategoryRuleRepo;
        const name = (entity as { name?: string } | null)?.name;
        if (name === 'Empresa') return { findOne: empresaFindOne };
        return linkedRepos.get(name ?? '') ?? mockTypeOrmRepo;
      });

      await repo.createMany(
        10,
        [
          {
            amount: 100,
            type: 'EXPENSE' as never,
            category_id: null,
            company_id: 5,
            description: '',
          },
        ] as never,
        { assignCategories: false },
      );

      const created = mockTypeOrmRepo.create.mock.calls.map((c) => c[0]);
      expect(created[0].category_id).toBe(7);
      expect(created[0].category_status).toBe(ReviewStatusEnum.CATEGORIZED);
      expect(empresaFindOne).toHaveBeenCalledTimes(1);
    });

    it('createMany: reutiliza la categoría de empresa cacheada para varios registros', async () => {
      mockTypeOrmRepo.create.mockImplementation((e: unknown) => e);
      mockTypeOrmRepo.save.mockResolvedValue([]);
      const empresaFindOne = jest
        .fn()
        .mockResolvedValue({ default_category_id: 7 });
      mockManager.getRepository.mockImplementation((entity: unknown) => {
        if (entity === TransactionRecord) return mockTypeOrmRepo;
        if (entity === TransactionCategoryRule) return mockCategoryRuleRepo;
        const name = (entity as { name?: string } | null)?.name;
        if (name === 'Empresa') return { findOne: empresaFindOne };
        return linkedRepos.get(name ?? '') ?? mockTypeOrmRepo;
      });

      await repo.createMany(
        10,
        [
          {
            amount: 100,
            type: 'EXPENSE' as never,
            category_id: null,
            company_id: 5,
            description: '',
          },
          {
            amount: 20,
            type: 'EXPENSE' as never,
            category_id: null,
            company_id: 5,
            description: '',
          },
        ] as never,
        { assignCategories: false },
      );

      expect(empresaFindOne).toHaveBeenCalledTimes(1);
    });

    it('update: usa la categoría por defecto de la empresa cuando no hay categoría', async () => {
      // newCategoryId = fields.category_id ?? previous.category_id; para que
      // termine siendo null (y así activar la rama de categoría por defecto
      // de empresa) ni el dto ni el registro previo pueden traer categoría.
      const existing = buildRecord({
        category_id: null,
        company_id: 5,
        description: '',
      });
      const updated = buildRecord({
        category_id: null,
        company_id: 5,
        description: '',
      });
      mockTypeOrmRepo.findOne.mockResolvedValue(existing);
      mockTypeOrmRepo.merge.mockReturnValue(updated);
      mockTypeOrmRepo.save.mockImplementation((e: object) =>
        Promise.resolve(e),
      );
      mockCategoryRuleRepo.findOne.mockResolvedValue(null);
      const empresaFindOne = jest
        .fn()
        .mockResolvedValue({ default_category_id: 11 });
      mockManager.getRepository.mockImplementation((entity: unknown) => {
        if (entity === TransactionRecord) return mockTypeOrmRepo;
        if (entity === TransactionCategoryRule) return mockCategoryRuleRepo;
        const name = (entity as { name?: string } | null)?.name;
        if (name === 'Empresa') return { findOne: empresaFindOne };
        return linkedRepos.get(name ?? '') ?? mockTypeOrmRepo;
      });

      const result = await repo.update(1, 10, {});

      expect(empresaFindOne).toHaveBeenCalled();
      expect(result.category_id).toBe(11);
      expect(result.category_status).toBe(ReviewStatusEnum.CATEGORIZED);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findAll: filtro por company_id
  // ─────────────────────────────────────────────────────────────
  describe('findAll - filtro por company_id', () => {
    it('aplica el filtro por company_id cuando se provee', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);

      await repo.findAll(10, { company_id: 5 });

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'tr.company_id = :company_id',
        { company_id: 5 },
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // createTransfer: validaciones de destino
  // ─────────────────────────────────────────────────────────────
  describe('createTransfer - validaciones de destino', () => {
    it('lanza BadRequestException si no se provee ningún destino', async () => {
      await expect(
        repo.createTransfer(10, {
          source_account_id: 100,
          amount: 100,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException si se proveen ambos destinos', async () => {
      await expect(
        repo.createTransfer(10, {
          source_account_id: 100,
          destination_account_id: 200,
          destination_liability_id: 300,
          amount: 100,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // createTransfer: destino pasivo (tarjeta de crédito)
  // ─────────────────────────────────────────────────────────────
  describe('createTransfer - destino pasivo', () => {
    const dto = {
      source_account_id: 100,
      destination_liability_id: 300,
      amount: 50000,
      transaction_date: '2026-08-01',
    };

    it('crea la transferencia con destino un pasivo financiero', async () => {
      mockTypeOrmRepo.create.mockImplementation((e: unknown) => e);
      mockTypeOrmRepo.save.mockImplementation((e: unknown) =>
        Promise.resolve({ ...(e as object), id: Math.random() }),
      );
      mockTypeOrmRepo.findOneBy.mockResolvedValue({
        id: 100,
        account_type: 'AHORROS',
        bank_name: 'Banco A',
        encrypted_balance: '100000',
      });
      const liabilityRepo = {
        findOneBy: jest.fn().mockResolvedValue({
          id: 300,
          liability_type: 'CREDIT_CARD',
          name: 'Tarjeta X',
          current_balance: 5000,
        }),
        save: jest.fn().mockImplementation((e: object) => Promise.resolve(e)),
      };
      mockManager.getRepository.mockImplementation((entity: unknown) => {
        if (entity === TransactionRecord) return mockTypeOrmRepo;
        if (entity === BankAccount) return mockTypeOrmRepo;
        const name = (entity as { name?: string } | null)?.name;
        if (name === FinancialLiability.name) return liabilityRepo;
        return linkedRepos.get(name ?? '') ?? mockTypeOrmRepo;
      });

      const [origin, destination] = await repo.createTransfer(10, dto);

      expect(liabilityRepo.findOneBy).toHaveBeenCalledWith(
        expect.objectContaining({ id: 300, user_id: 10 }),
      );
      expect(origin.origin_account_id).toBe(100);
      expect(destination.liability_id).toBe(300);
      expect(destination.destination_account).toBe('CREDIT_CARD');
      expect(destination.destination_bank).toBe('Tarjeta X');
    });

    it('lanza NotFoundException si el pasivo destino no existe', async () => {
      mockTypeOrmRepo.findOneBy.mockResolvedValue({
        id: 100,
        account_type: 'AHORROS',
        bank_name: 'Banco A',
        encrypted_balance: '100000',
      });
      const liabilityRepo = { findOneBy: jest.fn().mockResolvedValue(null) };
      mockManager.getRepository.mockImplementation((entity: unknown) => {
        if (entity === TransactionRecord) return mockTypeOrmRepo;
        if (entity === BankAccount) return mockTypeOrmRepo;
        const name = (entity as { name?: string } | null)?.name;
        if (name === FinancialLiability.name) return liabilityRepo;
        return linkedRepos.get(name ?? '') ?? mockTypeOrmRepo;
      });

      await expect(repo.createTransfer(10, dto as never)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // applyTransferAdjustment: pasivo vinculado
  // ─────────────────────────────────────────────────────────────
  describe('applyTransferAdjustment - pasivo vinculado', () => {
    it('reduce el saldo del pasivo vinculado a la transferencia', async () => {
      const record = buildRecord({
        transfer_group_id: 'g1',
        origin_account_id: 100,
        liability_id: 4,
        amount: 200,
      });
      mockTypeOrmRepo.findOne.mockResolvedValue(record);
      mockTypeOrmRepo.find.mockResolvedValue([record]);
      mockTypeOrmRepo.softRemove.mockResolvedValue([]);
      mockTypeOrmRepo.findOneBy.mockResolvedValue({
        id: 100,
        encrypted_balance: '100000',
      });
      const liabilityRepo = {
        findOneBy: jest.fn().mockResolvedValue({ id: 4, current_balance: 500 }),
        save: jest.fn().mockImplementation((e: object) => Promise.resolve(e)),
      };
      mockManager.getRepository.mockImplementation((entity: unknown) => {
        if (entity === TransactionRecord) return mockTypeOrmRepo;
        if (entity === BankAccount) return mockTypeOrmRepo;
        const name = (entity as { name?: string } | null)?.name;
        if (name === FinancialLiability.name) return liabilityRepo;
        return linkedRepos.get(name ?? '') ?? mockTypeOrmRepo;
      });

      await repo.softDeleteTransfer(1, 10);

      expect(liabilityRepo.save).toHaveBeenCalled();
      // sign=-1 revierte: -amount*sign = -200*-1 = 200 (abona de vuelta)
      const [savedLiability] = liabilityRepo.save.mock.calls[0] as [
        { current_balance: number },
      ];
      expect(savedLiability.current_balance).toBe(700);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // applyToEntity: saldo negativo no permitido
  // ─────────────────────────────────────────────────────────────
  describe('applyToEntity - saldo negativo', () => {
    it('lanza BadRequestException si el ajuste deja el saldo de la cuenta en negativo', async () => {
      const old = buildRecord({ amount: 100, type: 'expense', account_id: 1 });
      const updated = buildRecord({
        amount: 500,
        type: 'expense',
        account_id: 1,
      });
      mockTypeOrmRepo.findOne.mockResolvedValue(old);
      mockTypeOrmRepo.merge.mockReturnValue(updated);
      mockTypeOrmRepo.findOneBy.mockResolvedValue({
        id: 1,
        bank_name: 'Bancolombia',
        encrypted_balance: '100',
      });

      await expect(repo.update(1, 10, { amount: 500 })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // updateTransfer: campos fijos (is_fixed, fixed_type, frequency, due_day, reminder_days)
  // ─────────────────────────────────────────────────────────────
  describe('updateTransfer - campos de recurrencia', () => {
    it('actualiza los campos de recurrencia de ambos movimientos', async () => {
      const record = buildRecord({
        transfer_group_id: 'g1',
        origin_account_id: 100,
        destination_account_id: 200,
        amount: 50000,
      });
      mockTypeOrmRepo.findOne.mockResolvedValue(record);
      mockTypeOrmRepo.find.mockResolvedValue([record]);
      mockTypeOrmRepo.merge.mockImplementation(
        (old: object, fields: object) => ({ ...old, ...fields }),
      );
      mockTypeOrmRepo.save.mockImplementation((e: object) =>
        Promise.resolve(e),
      );
      mockTypeOrmRepo.findOneBy.mockResolvedValue({
        id: 100,
        encrypted_balance: '1000000',
        current_balance: 0,
        target_amount: 1000,
      });

      await repo.updateTransfer(1, 10, {
        is_fixed: true,
        fixed_type: 'deduction' as never,
        frequency: 'monthly' as never,
        due_day: 5,
        reminder_days: 2,
      });

      const mergedSave = mockTypeOrmRepo.save.mock.calls
        .map((call) => call[0] as Record<string, unknown>)
        .find((s) => s?.id === 1);
      expect(mergedSave?.is_fixed).toBe(true);
      expect(mergedSave?.fixed_type).toBe('deduction');
      expect(mergedSave?.frequency).toBe('monthly');
      expect(mergedSave?.due_day).toBe(5);
      expect(mergedSave?.reminder_days).toBe(2);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // clone
  // ─────────────────────────────────────────────────────────────
  describe('clone', () => {
    it('lanza BadRequestException si la transacción original es una transferencia', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(
        buildRecord({ transfer_group_id: 'g1' }),
      );

      await expect(repo.clone(1, 10, {})).rejects.toThrow(BadRequestException);
    });

    it('clona una transacción copiando campos y aplicando overrides', async () => {
      const original = buildRecord({
        id: 1,
        category_id: 2,
        subcategory_id: 3,
        type: 'expense',
        amount: 100,
        currency: 'COP',
        description: 'Original',
        transaction_date: new Date('2026-08-01'),
        company_id: null,
        account_id: 1,
      });
      mockTypeOrmRepo.findOne.mockResolvedValue(original);
      mockTypeOrmRepo.create.mockImplementation((e: unknown) => e);
      const cloned = buildRecord({
        id: 99,
        category_id: 2,
        amount: 200,
        description: 'Clonada',
        account_id: 1,
      });
      mockTypeOrmRepo.save.mockResolvedValue(cloned);
      mockTypeOrmRepo.findOneBy.mockResolvedValue({
        id: 1,
        encrypted_balance: '1000',
      });

      const result = await repo.clone(1, 10, {
        amount: 200,
        description: 'Clonada',
      });

      expect(result).toEqual(cloned);
      const createArg = mockTypeOrmRepo.create.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(createArg.amount).toBe(200);
      expect(createArg.description).toBe('Clonada');
      expect(createArg.category_id).toBe(2);
      expect(createArg.category_status).toBe(ReviewStatusEnum.CATEGORIZED);
    });

    it('clona usando la categoría por defecto de la empresa si no hay categoría', async () => {
      const original = buildRecord({
        id: 1,
        category_id: null,
        type: 'expense',
        amount: 100,
        description: '',
        company_id: 5,
      });
      mockTypeOrmRepo.findOne.mockResolvedValue(original);
      mockTypeOrmRepo.create.mockImplementation((e: unknown) => e);
      mockTypeOrmRepo.save.mockImplementation((e: object) =>
        Promise.resolve({ ...e, id: 99 }),
      );
      mockCategoryRuleRepo.findOne.mockResolvedValue(null);
      const empresaFindOne = jest
        .fn()
        .mockResolvedValue({ default_category_id: 8 });
      mockManager.getRepository.mockImplementation((entity: unknown) => {
        if (entity === TransactionRecord) return mockTypeOrmRepo;
        if (entity === TransactionCategoryRule) return mockCategoryRuleRepo;
        const name = (entity as { name?: string } | null)?.name;
        if (name === 'Empresa') return { findOne: empresaFindOne };
        return linkedRepos.get(name ?? '') ?? mockTypeOrmRepo;
      });

      const result = await repo.clone(1, 10, {});

      expect(empresaFindOne).toHaveBeenCalled();
      expect(result.category_id).toBe(8);
      expect(result.category_status).toBe(ReviewStatusEnum.CATEGORIZED);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // cloneTransfer
  // ─────────────────────────────────────────────────────────────
  describe('cloneTransfer', () => {
    it('lanza NotFoundException si findTransferById no encuentra el registro', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      await expect(repo.cloneTransfer(1, 10, {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lanza NotFoundException si findTransferById devuelve una lista vacía', async () => {
      jest.spyOn(repo, 'findTransferById').mockResolvedValue([]);

      await expect(repo.cloneTransfer(1, 10, {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('clona ambas piernas de una transferencia completa (cuenta origen y destino)', async () => {
      const origin = buildRecord({
        id: 1,
        transfer_group_id: 'g1',
        origin_account_id: 100,
        source_account: 'AHORROS',
        source_bank: 'Banco A',
        amount: 50000,
        currency: 'COP',
        description: 'Original',
        transaction_date: '2026-08-01',
        company_id: null,
        is_fixed: false,
      });
      const destination = buildRecord({
        id: 2,
        transfer_group_id: 'g1',
        destination_account_id: 200,
        destination_account: 'AHORROS',
        destination_bank: 'Banco B',
        objective_id: 3,
        amount: 50000,
        currency: 'COP',
      });
      mockTypeOrmRepo.findOne.mockResolvedValue(origin);
      mockTypeOrmRepo.find.mockResolvedValue([origin, destination]);
      mockTypeOrmRepo.create.mockImplementation((e: unknown) => e);
      mockTypeOrmRepo.save.mockImplementation((e: unknown) =>
        Promise.resolve({ ...(e as object), id: Math.random() }),
      );
      mockTypeOrmRepo.findOneBy.mockResolvedValue({
        id: 100,
        current_balance: 1000,
        target_amount: 5000,
        encrypted_balance: '1000000',
      });

      const result = await repo.cloneTransfer(1, 10, {
        amount: 60000,
        description: 'Clonada',
      });

      expect(result).toHaveLength(2);
      const [savedOrigin, savedDestination] = result as unknown as Array<
        Record<string, unknown>
      >;
      expect(savedOrigin.origin_account_id).toBe(100);
      expect(savedOrigin.source_account).toBe('AHORROS');
      expect(savedDestination.destination_account_id).toBe(200);
      expect(savedDestination.objective_id).toBe(3);
      expect(savedDestination.description).toBe('Clonada');
    });

    it('clona una pierna con destino en un pasivo, usando valores de la plantilla', async () => {
      const record = buildRecord({
        id: 1,
        transfer_group_id: 'g1',
        liability_id: 4,
        destination_account: 'CREDIT_CARD',
        destination_bank: 'Tarjeta X',
        objective_id: null,
        amount: 30000,
        currency: 'COP',
        source_account: 'AHORROS',
        source_bank: 'Banco A',
      });
      mockTypeOrmRepo.findOne.mockResolvedValue(record);
      mockTypeOrmRepo.find.mockResolvedValue([record]);
      mockTypeOrmRepo.create.mockImplementation((e: unknown) => e);
      mockTypeOrmRepo.save.mockImplementation((e: unknown) =>
        Promise.resolve({ ...(e as object), id: Math.random() }),
      );
      mockTypeOrmRepo.findOneBy.mockResolvedValue({
        id: 4,
        current_balance: 1000,
      });

      const result = await repo.cloneTransfer(1, 10, {});

      expect(result).toHaveLength(1);
      const [saved] = result as unknown as Array<Record<string, unknown>>;
      expect(saved.liability_id).toBe(4);
      expect(saved.source_account).toBe('AHORROS');
      expect(saved.source_bank).toBe('Banco A');
    });

    it('usa el monto y fecha originales cuando no se proveen overrides', async () => {
      const record = buildRecord({
        id: 1,
        transfer_group_id: 'g1',
        origin_account_id: 100,
        amount: 15000,
        transaction_date: '2026-07-01',
        description: 'Movimiento base',
        currency: 'COP',
      });
      mockTypeOrmRepo.findOne.mockResolvedValue(record);
      mockTypeOrmRepo.find.mockResolvedValue([record]);
      mockTypeOrmRepo.create.mockImplementation((e: unknown) => e);
      mockTypeOrmRepo.save.mockImplementation((e: unknown) =>
        Promise.resolve({ ...(e as object), id: Math.random() }),
      );
      mockTypeOrmRepo.findOneBy.mockResolvedValue({
        id: 100,
        encrypted_balance: '1000000',
      });

      const result = await repo.cloneTransfer(1, 10, {});

      const [saved] = result as unknown as Array<Record<string, unknown>>;
      expect(saved.amount).toBe(15000);
      expect(saved.transaction_date).toBe('2026-07-01');
      expect(saved.description).toBe('Movimiento base');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findEmpresasForUser
  // ─────────────────────────────────────────────────────────────
  describe('findEmpresasForUser', () => {
    it('consulta empresas activas del usuario vía dataSource.getRepository', async () => {
      mockEmpresaRepo.find.mockResolvedValue([{ id: 1, name: 'Empresa A' }]);

      const result = await repo.findEmpresasForUser(10);

      expect(mockDataSource.getRepository).toHaveBeenCalledWith(Empresa);
      expect(result).toEqual([{ id: 1, name: 'Empresa A' }]);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // getSummary: desglose por empresa (by_company)
  // ─────────────────────────────────────────────────────────────
  describe('getSummary - desglose por empresa', () => {
    it('incluye by_company con nombre resuelto y porcentaje del total', async () => {
      mockQb.getRawMany
        .mockResolvedValueOnce([
          { type: 'expense', amount: '1000', count: '2' },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { company_id: '5', amount: '400', count: '1' },
        ]);
      mockEmpresaRepo.find.mockResolvedValue([
        { id: 5, name: 'Empresa A' },
        { id: 6, name: 'Empresa B' },
      ]);

      const result = await repo.getSummary(10, {
        date_from: '2026-08-01',
        date_to: '2026-08-31',
      });

      expect(result.by_company).toEqual([
        {
          company_id: 5,
          company_name: 'Empresa A',
          expenses: 400,
          count: 1,
          percent_of_total: 40,
        },
      ]);
    });

    it('usa null como nombre de empresa si no se encuentra en el catálogo', async () => {
      mockQb.getRawMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { company_id: '9', amount: '100', count: '1' },
        ]);
      mockEmpresaRepo.find.mockResolvedValue([]);

      const result = await repo.getSummary(10, {});

      expect(result.by_company).toEqual([
        {
          company_id: 9,
          company_name: null,
          expenses: 100,
          count: 1,
          percent_of_total: 0,
        },
      ]);
    });
  });
});

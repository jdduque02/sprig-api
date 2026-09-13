import { Test, TestingModule } from '@nestjs/testing';
import {
  CategoryBudgetService,
  periodDateRange,
  budgetStatus,
} from '@finance/service/category-budget.service';
import { CategoryBudgetRepository } from '@finance/repositories/category-budget.repository';
import { TransactionRecordRepository } from '@finance/repositories/transaction-record.repository';
import { CategoryService } from '@catalog/service/category.service';
import { SubcategoryService } from '@catalog/service/subcategory.service';

const mockCategoryBudgetRepository = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
};

const mockTransactionRecordRepository = {
  getExpenseTotalByCategory: jest.fn(),
};

const mockCategoryService = {
  findOne: jest.fn(),
};

const mockSubcategoryService = {
  findOne: jest.fn(),
};

const buildBudget = (overrides = {}) => ({
  id: 1,
  user_id: 10,
  category_id: 3,
  subcategory_id: null,
  year: 2026,
  month: 4,
  limit_amount: 500000,
  currency: 'COP',
  alert_threshold_percent: 80,
  is_active: true,
  created_at: new Date(),
  updated_at: null,
  ...overrides,
});

describe('periodDateRange', () => {
  it('calcula el rango de fechas del mes', () => {
    expect(periodDateRange(2026, 4)).toEqual({
      dateFrom: '2026-04-01',
      dateTo: '2026-04-30',
    });
  });

  it('respeta meses de 31 días y febrero', () => {
    expect(periodDateRange(2026, 1).dateTo).toBe('2026-01-31');
    expect(periodDateRange(2026, 2).dateTo).toBe('2026-02-28');
  });
});

describe('budgetStatus', () => {
  it('retorna ok por debajo del umbral', () => {
    expect(budgetStatus(50, 80)).toBe('ok');
  });

  it('retorna warning entre el umbral y 100%', () => {
    expect(budgetStatus(85, 80)).toBe('warning');
  });

  it('retorna exceeded en 100% o más', () => {
    expect(budgetStatus(120, 80)).toBe('exceeded');
  });
});

describe('CategoryBudgetService', () => {
  let service: CategoryBudgetService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryBudgetService,
        {
          provide: CategoryBudgetRepository,
          useValue: mockCategoryBudgetRepository,
        },
        {
          provide: TransactionRecordRepository,
          useValue: mockTransactionRecordRepository,
        },
        { provide: CategoryService, useValue: mockCategoryService },
        { provide: SubcategoryService, useValue: mockSubcategoryService },
      ],
    }).compile();

    service = module.get<CategoryBudgetService>(CategoryBudgetService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('valida la categoría y crea el presupuesto', async () => {
      mockCategoryService.findOne.mockResolvedValue({ id: 3 });
      const created = buildBudget();
      mockCategoryBudgetRepository.create.mockResolvedValue(created);
      mockTransactionRecordRepository.getExpenseTotalByCategory.mockResolvedValue(
        0,
      );

      const result = await service.create(10, {
        category_id: 3,
        year: 2026,
        month: 4,
        limit_amount: 500000,
      });

      expect(mockCategoryService.findOne).toHaveBeenCalledWith(3);
      expect(mockSubcategoryService.findOne).not.toHaveBeenCalled();
      expect(result.id).toBe(1);
      expect(result.percent_used).toBe(0);
      expect(result.status).toBe('ok');
    });

    it('valida la subcategoría cuando se especifica', async () => {
      mockCategoryService.findOne.mockResolvedValue({ id: 3 });
      mockSubcategoryService.findOne.mockResolvedValue({ id: 12 });
      mockCategoryBudgetRepository.create.mockResolvedValue(
        buildBudget({ subcategory_id: 12 }),
      );
      mockTransactionRecordRepository.getExpenseTotalByCategory.mockResolvedValue(
        0,
      );

      await service.create(10, {
        category_id: 3,
        subcategory_id: 12,
        year: 2026,
        month: 4,
        limit_amount: 500000,
      });

      expect(mockSubcategoryService.findOne).toHaveBeenCalledWith(12, 10);
    });
  });

  describe('findAll', () => {
    it('mapea cada presupuesto a su respuesta con uso calculado', async () => {
      mockCategoryBudgetRepository.findAll.mockResolvedValue([
        buildBudget({ id: 1 }),
        buildBudget({ id: 2 }),
      ]);
      mockTransactionRecordRepository.getExpenseTotalByCategory.mockResolvedValue(
        0,
      );

      const result = await service.findAll(10, {});

      expect(mockCategoryBudgetRepository.findAll).toHaveBeenCalledWith(10, {});
      expect(result).toHaveLength(2);
    });
  });

  describe('update', () => {
    it('valida categoría y subcategoría cuando se envían en la actualización', async () => {
      mockCategoryService.findOne.mockResolvedValue({ id: 5 });
      mockSubcategoryService.findOne.mockResolvedValue({ id: 20 });
      mockCategoryBudgetRepository.update.mockResolvedValue(
        buildBudget({ category_id: 5, subcategory_id: 20 }),
      );
      mockTransactionRecordRepository.getExpenseTotalByCategory.mockResolvedValue(
        0,
      );

      await service.update(1, 10, { category_id: 5, subcategory_id: 20 });

      expect(mockCategoryService.findOne).toHaveBeenCalledWith(5);
      expect(mockSubcategoryService.findOne).toHaveBeenCalledWith(20, 10);
      expect(mockCategoryBudgetRepository.update).toHaveBeenCalledWith(1, 10, {
        category_id: 5,
        subcategory_id: 20,
      });
    });

    it('no valida categoría/subcategoría si no se envían', async () => {
      mockCategoryBudgetRepository.update.mockResolvedValue(buildBudget());
      mockTransactionRecordRepository.getExpenseTotalByCategory.mockResolvedValue(
        0,
      );

      await service.update(1, 10, { limit_amount: 700000 });

      expect(mockCategoryService.findOne).not.toHaveBeenCalled();
      expect(mockSubcategoryService.findOne).not.toHaveBeenCalled();
    });
  });

  describe('usage computation via findOne', () => {
    it('marca warning cuando el gasto supera el umbral', async () => {
      mockCategoryBudgetRepository.findById.mockResolvedValue(buildBudget());
      mockTransactionRecordRepository.getExpenseTotalByCategory.mockResolvedValue(
        450000,
      );

      const result = await service.findOne(1, 10);

      expect(result.spent_amount).toBe(450000);
      expect(result.percent_used).toBe(90);
      expect(result.status).toBe('warning');
    });

    it('marca exceeded cuando el gasto supera el límite', async () => {
      mockCategoryBudgetRepository.findById.mockResolvedValue(buildBudget());
      mockTransactionRecordRepository.getExpenseTotalByCategory.mockResolvedValue(
        600000,
      );

      const result = await service.findOne(1, 10);

      expect(result.status).toBe('exceeded');
    });

    it('retorna 0% cuando el límite es 0 (evita división por cero)', async () => {
      mockCategoryBudgetRepository.findById.mockResolvedValue(
        buildBudget({ limit_amount: 0 }),
      );
      mockTransactionRecordRepository.getExpenseTotalByCategory.mockResolvedValue(
        100,
      );

      const result = await service.findOne(1, 10);

      expect(result.percent_used).toBe(0);
      expect(result.status).toBe('ok');
    });
  });

  describe('remove', () => {
    it('delega el soft delete al repositorio', async () => {
      mockCategoryBudgetRepository.softDelete.mockResolvedValue(undefined);

      await service.remove(1, 10);

      expect(mockCategoryBudgetRepository.softDelete).toHaveBeenCalledWith(
        1,
        10,
      );
    });
  });
});

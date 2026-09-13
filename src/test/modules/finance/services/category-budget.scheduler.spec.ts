import { Test, TestingModule } from '@nestjs/testing';
import { CategoryBudgetScheduler } from '@finance/service/category-budget.scheduler';
import { CategoryBudgetRepository } from '@finance/repositories/category-budget.repository';
import { TransactionRecordRepository } from '@finance/repositories/transaction-record.repository';
import { NotificationService } from '@notification/service/notification.service';
import { UserRepository } from '@identity/repositories/app-user.repositories';

const mockCategoryBudgetRepository = {
  findAllActive: jest.fn(),
};

const mockTransactionRecordRepository = {
  getExpenseTotalByCategory: jest.fn(),
};

const mockNotificationService = {
  createIfMissing: jest.fn(),
};

const mockUserRepository = {
  findById: jest.fn(),
};

function currentYearMonth(): [number, number] {
  const now = new Date();
  return [now.getFullYear(), now.getMonth() + 1];
}

const buildBudget = (overrides = {}) => {
  const [year, month] = currentYearMonth();
  return {
    id: 1,
    user_id: 10,
    category_id: 3,
    subcategory_id: null,
    year,
    month,
    limit_amount: 500000,
    alert_threshold_percent: 80,
    is_active: true,
    ...overrides,
  };
};

describe('CategoryBudgetScheduler', () => {
  let scheduler: CategoryBudgetScheduler;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryBudgetScheduler,
        {
          provide: CategoryBudgetRepository,
          useValue: mockCategoryBudgetRepository,
        },
        {
          provide: TransactionRecordRepository,
          useValue: mockTransactionRecordRepository,
        },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: UserRepository, useValue: mockUserRepository },
      ],
    }).compile();

    scheduler = module.get<CategoryBudgetScheduler>(CategoryBudgetScheduler);
    jest.clearAllMocks();
    mockUserRepository.findById.mockResolvedValue({
      timezone: 'America/Bogota',
    });
  });

  it('crea alerta de warning cuando el gasto se acerca al límite', async () => {
    mockCategoryBudgetRepository.findAllActive.mockResolvedValue([
      buildBudget(),
    ]);
    mockTransactionRecordRepository.getExpenseTotalByCategory.mockResolvedValue(
      450000,
    );

    await scheduler.handleBudgetAlerts();

    expect(mockNotificationService.createIfMissing).toHaveBeenCalledTimes(1);
    const [userId, , reference] = mockNotificationService.createIfMissing.mock
      .calls[0] as unknown[];
    expect(userId).toBe(10);
    expect(reference).toContain(':warning');
  });

  it('crea alerta de exceeded cuando se supera el límite', async () => {
    mockCategoryBudgetRepository.findAllActive.mockResolvedValue([
      buildBudget(),
    ]);
    mockTransactionRecordRepository.getExpenseTotalByCategory.mockResolvedValue(
      600000,
    );

    await scheduler.handleBudgetAlerts();

    const [, , reference] = mockNotificationService.createIfMissing.mock
      .calls[0] as unknown[];
    expect(reference).toContain(':exceeded');
  });

  it('no crea alerta si el gasto está por debajo del umbral', async () => {
    mockCategoryBudgetRepository.findAllActive.mockResolvedValue([
      buildBudget(),
    ]);
    mockTransactionRecordRepository.getExpenseTotalByCategory.mockResolvedValue(
      100000,
    );

    await scheduler.handleBudgetAlerts();

    expect(mockNotificationService.createIfMissing).not.toHaveBeenCalled();
  });

  it('omite presupuestos que no son del periodo vigente', async () => {
    mockCategoryBudgetRepository.findAllActive.mockResolvedValue([
      buildBudget({ year: 2000, month: 1 }),
    ]);

    await scheduler.handleBudgetAlerts();

    expect(
      mockTransactionRecordRepository.getExpenseTotalByCategory,
    ).not.toHaveBeenCalled();
    expect(mockNotificationService.createIfMissing).not.toHaveBeenCalled();
  });

  it('no falla si la consulta de presupuestos activos lanza un error', async () => {
    mockCategoryBudgetRepository.findAllActive.mockRejectedValue(
      new Error('db down'),
    );

    await expect(scheduler.handleBudgetAlerts()).resolves.toBeUndefined();
  });

  it('usa zona horaria por defecto si el usuario no existe', async () => {
    mockUserRepository.findById.mockRejectedValueOnce(new Error('not found'));
    mockCategoryBudgetRepository.findAllActive.mockResolvedValue([
      buildBudget(),
    ]);
    mockTransactionRecordRepository.getExpenseTotalByCategory.mockResolvedValue(
      600000,
    );

    await scheduler.handleBudgetAlerts();

    expect(mockNotificationService.createIfMissing).toHaveBeenCalledTimes(1);
  });

  it('ignora presupuestos con límite 0', async () => {
    mockCategoryBudgetRepository.findAllActive.mockResolvedValue([
      buildBudget({ limit_amount: 0 }),
    ]);

    await scheduler.handleBudgetAlerts();

    expect(mockNotificationService.createIfMissing).not.toHaveBeenCalled();
  });
});

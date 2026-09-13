import { CategoryBudgetController } from '@finance/controller/category-budget.controller';
import { CategoryBudgetService } from '@finance/service/category-budget.service';
import { IntrospectResponse } from '@auth/interfaces/IntrospectResponse.dto';

const mockCategoryBudgetService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

const currentUser: IntrospectResponse = { sub: 'kc-uuid' };

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
  spent_amount: 0,
  percent_used: 0,
  status: 'ok' as const,
  created_at: new Date(),
  updated_at: null,
  ...overrides,
});

describe('CategoryBudgetController', () => {
  let controller: CategoryBudgetController;

  beforeEach(() => {
    controller = new CategoryBudgetController(
      mockCategoryBudgetService as unknown as CategoryBudgetService,
    );
    jest.clearAllMocks();
  });

  it('crea un presupuesto delegando al servicio', async () => {
    const dto = {
      category_id: 3,
      year: 2026,
      month: 4,
      limit_amount: 500000,
    };
    const created = buildBudget();
    mockCategoryBudgetService.create.mockResolvedValue(created);

    const result = await controller.create(10, dto, currentUser);

    expect(mockCategoryBudgetService.create).toHaveBeenCalledWith(10, dto);
    expect(result).toEqual(created);
  });

  it('lista los presupuestos del usuario', async () => {
    mockCategoryBudgetService.findAll.mockResolvedValue([buildBudget()]);

    const result = await controller.findAll(10, {}, currentUser);

    expect(mockCategoryBudgetService.findAll).toHaveBeenCalledWith(10, {});
    expect(result).toHaveLength(1);
  });

  it('obtiene un presupuesto por id', async () => {
    mockCategoryBudgetService.findOne.mockResolvedValue(buildBudget());

    const result = await controller.findOne(10, 1, currentUser);

    expect(mockCategoryBudgetService.findOne).toHaveBeenCalledWith(1, 10);
    expect(result.id).toBe(1);
  });

  it('actualiza un presupuesto', async () => {
    const dto = { limit_amount: 600000 };
    mockCategoryBudgetService.update.mockResolvedValue(
      buildBudget({ limit_amount: 600000 }),
    );

    const result = await controller.update(10, 1, dto, currentUser);

    expect(mockCategoryBudgetService.update).toHaveBeenCalledWith(1, 10, dto);
    expect(result.limit_amount).toBe(600000);
  });

  it('elimina (soft) un presupuesto', async () => {
    mockCategoryBudgetService.remove.mockResolvedValue(undefined);

    await controller.remove(10, 1, currentUser);

    expect(mockCategoryBudgetService.remove).toHaveBeenCalledWith(1, 10);
  });
});

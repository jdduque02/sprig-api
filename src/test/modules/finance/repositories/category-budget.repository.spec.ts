import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { Repository } from 'typeorm';
import { CategoryBudgetRepository } from '@finance/repositories/category-budget.repository';
import { CategoryBudget } from '@finance/entities/category-budget.entity';

type CategoryBudgetRepoMock = jest.Mocked<
  Pick<
    Repository<CategoryBudget>,
    'create' | 'save' | 'findOne' | 'merge' | 'softRemove'
  >
> & { find: jest.MockedFunction<() => Promise<CategoryBudget[]>> };

const mockRepo: CategoryBudgetRepoMock = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  merge: jest.fn(),
  softRemove: jest.fn(),
};

const mockI18nService = {
  t: jest.fn((key: string) => key),
};

describe('CategoryBudgetRepository', () => {
  let repository: CategoryBudgetRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryBudgetRepository,
        { provide: getRepositoryToken(CategoryBudget), useValue: mockRepo },
        { provide: I18nService, useValue: mockI18nService },
      ],
    }).compile();

    repository = module.get<CategoryBudgetRepository>(CategoryBudgetRepository);
    jest.clearAllMocks();
  });

  it('crea un presupuesto con valores por defecto', async () => {
    mockRepo.findOne.mockResolvedValueOnce(null);
    mockRepo.create.mockReturnValue({ id: 1 });
    mockRepo.save.mockResolvedValue({ id: 1 });

    await repository.create(10, {
      category_id: 3,
      year: 2026,
      month: 4,
      limit_amount: 500000,
    });

    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 10,
        subcategory_id: null,
        currency: 'COP',
        alert_threshold_percent: 80,
      }),
    );
  });

  it('lanza ConflictException si ya existe un presupuesto para la misma categoría/periodo', async () => {
    mockRepo.findOne.mockResolvedValueOnce({ id: 99 });

    await expect(
      repository.create(10, {
        category_id: 3,
        year: 2026,
        month: 4,
        limit_amount: 500000,
      }),
    ).rejects.toThrow(ConflictException);
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('lanza NotFoundException si el presupuesto no existe', async () => {
    mockRepo.findOne.mockResolvedValue(null);

    await expect(repository.findById(1, 10)).rejects.toThrow(NotFoundException);
  });

  it('filtra por año/mes/categoría al listar', async () => {
    mockRepo.find.mockResolvedValue([]);

    await repository.findAll(10, { year: 2026, month: 4, category_id: 3 });

    const call = mockRepo.find.mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
    };
    expect(call.where).toMatchObject({
      user_id: 10,
      year: 2026,
      month: 4,
      category_id: 3,
    });
  });

  it('actualiza el presupuesto existente', async () => {
    const existing = { id: 1, user_id: 10 };
    mockRepo.findOne.mockResolvedValue(existing);
    mockRepo.merge.mockReturnValue({ ...existing, limit_amount: 600000 });
    mockRepo.save.mockResolvedValue({ ...existing, limit_amount: 600000 });

    const result = await repository.update(1, 10, { limit_amount: 600000 });

    expect(result.limit_amount).toBe(600000);
  });

  it('elimina (soft) el presupuesto existente', async () => {
    const existing = { id: 1, user_id: 10 };
    mockRepo.findOne.mockResolvedValue(existing);
    mockRepo.softRemove.mockResolvedValue(existing);

    await repository.softDelete(1, 10);

    expect(mockRepo.softRemove).toHaveBeenCalledWith(existing);
  });
});

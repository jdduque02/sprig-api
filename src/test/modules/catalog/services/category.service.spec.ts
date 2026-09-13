import { Test, TestingModule } from '@nestjs/testing';
import { CategoryService } from '@catalog/service/category.service';
import { CategoryRepository } from '@catalog/repositories/category.repository';
import { TransactionTypeEnum } from '@shared/enums';
import { Category } from '@catalog/entities/category.entity';

const mockCategoryRepository = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
};

const buildCategory = (overrides = {}): Category =>
  ({
    id: 1,
    name: 'Alimentación',
    group_type: TransactionTypeEnum.EXPENSE,
    icon_key: 'food-fork-drink',
    color_hex: '#FF5733',
    is_active: true,
    sort_order: 0,
    ...overrides,
  }) as unknown as Category;

describe('CategoryService', () => {
  let service: CategoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryService,
        { provide: CategoryRepository, useValue: mockCategoryRepository },
      ],
    }).compile();

    service = module.get<CategoryService>(CategoryService);
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // create
  // ─────────────────────────────────────────────────────────────
  describe('create', () => {
    it('debe delegar al repositorio y retornar la categoría creada', async () => {
      const dto = {
        name: 'Alimentación',
        group_type: TransactionTypeEnum.EXPENSE,
      };
      const category = buildCategory();
      mockCategoryRepository.create.mockResolvedValue(category);

      const result = await service.create(dto);

      expect(mockCategoryRepository.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(category);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findAll
  // ─────────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('debe retornar todas las categorías', async () => {
      const list = [
        buildCategory(),
        buildCategory({ id: 2, name: 'Transporte' }),
      ];
      mockCategoryRepository.findAll.mockResolvedValue(list);

      const result = await service.findAll();

      expect(mockCategoryRepository.findAll).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(2);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findOne
  // ─────────────────────────────────────────────────────────────
  describe('findOne', () => {
    it('debe retornar la categoría por id', async () => {
      const category = buildCategory();
      mockCategoryRepository.findById.mockResolvedValue(category);

      const result = await service.findOne(1);

      expect(mockCategoryRepository.findById).toHaveBeenCalledWith(1);
      expect(result).toEqual(category);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // update
  // ─────────────────────────────────────────────────────────────
  describe('update', () => {
    it('debe actualizar y retornar la categoría', async () => {
      const dto = { name: 'Comida' };
      const updated = buildCategory({ name: 'Comida' });
      mockCategoryRepository.update.mockResolvedValue(updated);

      const result = await service.update(1, dto);

      expect(mockCategoryRepository.update).toHaveBeenCalledWith(1, dto);
      expect(result.name).toBe('Comida');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // remove
  // ─────────────────────────────────────────────────────────────
  describe('remove', () => {
    it('debe delegar el borrado lógico al repositorio', async () => {
      mockCategoryRepository.softDelete.mockResolvedValue(undefined);

      await service.remove(1);

      expect(mockCategoryRepository.softDelete).toHaveBeenCalledWith(1);
    });
  });
});

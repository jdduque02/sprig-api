import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SubcategoryService } from '@catalog/service/subcategory.service';
import { SubcategoryRepository } from '@catalog/repositories/subcategory.repository';
import { Subcategory } from '@catalog/entities/subcategory.entity';

const mockSubcategoryRepository = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
};

const buildSubcategory = (overrides = {}): Subcategory =>
  ({
    id: 1,
    name: 'Supermercado',
    category_id: 1,
    user_id: 10,
    is_active: true,
    ...overrides,
  }) as unknown as Subcategory;

describe('SubcategoryService', () => {
  let service: SubcategoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubcategoryService,
        { provide: SubcategoryRepository, useValue: mockSubcategoryRepository },
      ],
    }).compile();

    service = module.get<SubcategoryService>(SubcategoryService);
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // create
  // ─────────────────────────────────────────────────────────────
  describe('create', () => {
    it('debe delegar al repositorio y retornar la subcategoría creada', async () => {
      const dto = { name: 'Supermercado', category_id: 1 };
      const subcategory = buildSubcategory();
      mockSubcategoryRepository.create.mockResolvedValue(subcategory);

      const result = await service.create(10, dto);

      expect(mockSubcategoryRepository.create).toHaveBeenCalledWith(10, dto);
      expect(result).toEqual(subcategory);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findAll
  // ─────────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('debe retornar lista sin filtro de categoría', async () => {
      const list = [buildSubcategory()];
      mockSubcategoryRepository.findAll.mockResolvedValue(list);

      const result = await service.findAll(10);

      expect(mockSubcategoryRepository.findAll).toHaveBeenCalledWith(
        10,
        undefined,
      );
      expect(result).toHaveLength(1);
    });

    it('debe retornar lista filtrada por categoryId', async () => {
      const list = [buildSubcategory()];
      mockSubcategoryRepository.findAll.mockResolvedValue(list);

      const result = await service.findAll(10, 1);

      expect(mockSubcategoryRepository.findAll).toHaveBeenCalledWith(10, 1);
      expect(result).toHaveLength(1);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findOne
  // ─────────────────────────────────────────────────────────────
  describe('findOne', () => {
    it('debe retornar la subcategoría por id', async () => {
      const subcategory = buildSubcategory();
      mockSubcategoryRepository.findById.mockResolvedValue(subcategory);

      const result = await service.findOne(1, 10);

      expect(mockSubcategoryRepository.findById).toHaveBeenCalledWith(1, 10);
      expect(result).toEqual(subcategory);
    });

    it('debe propagar NotFoundException del repositorio', async () => {
      mockSubcategoryRepository.findById.mockRejectedValue(
        new NotFoundException(),
      );

      await expect(service.findOne(999, 10)).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // update
  // ─────────────────────────────────────────────────────────────
  describe('update', () => {
    it('debe actualizar y retornar la subcategoría', async () => {
      const dto = { name: 'Mercado' };
      const updated = buildSubcategory({ name: 'Mercado' });
      mockSubcategoryRepository.update.mockResolvedValue(updated);

      const result = await service.update(1, 10, dto);

      expect(mockSubcategoryRepository.update).toHaveBeenCalledWith(1, 10, dto);
      expect(result.name).toBe('Mercado');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // remove
  // ─────────────────────────────────────────────────────────────
  describe('remove', () => {
    it('debe delegar softDelete al repositorio sin excepción', async () => {
      mockSubcategoryRepository.softDelete.mockResolvedValue(undefined);

      await expect(service.remove(1, 10)).resolves.toBeUndefined();

      expect(mockSubcategoryRepository.softDelete).toHaveBeenCalledWith(1, 10);
    });

    it('debe propagar NotFoundException del repositorio', async () => {
      mockSubcategoryRepository.softDelete.mockRejectedValue(
        new NotFoundException(),
      );

      await expect(service.remove(999, 10)).rejects.toThrow(NotFoundException);
    });
  });
});

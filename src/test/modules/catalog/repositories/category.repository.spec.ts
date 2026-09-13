import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { QueryFailedError } from 'typeorm';
import { CategoryRepository } from '@catalog/repositories/category.repository';
import { Category } from '@catalog/entities/category.entity';
import { CreateCategoryDto } from '@catalog/dto/category/create-category.dto';
import { TransactionTypeEnum } from '@shared/enums';

const mockTypeOrmRepo = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  merge: jest.fn(),
};

const mockI18nService = {
  t: jest.fn((key: string) => `[${key}]`),
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

describe('CategoryRepository', () => {
  let repo: CategoryRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryRepository,
        { provide: getRepositoryToken(Category), useValue: mockTypeOrmRepo },
        { provide: I18nService, useValue: mockI18nService },
      ],
    }).compile();

    repo = module.get<CategoryRepository>(CategoryRepository);
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // create
  // ─────────────────────────────────────────────────────────────
  describe('create', () => {
    const dto: CreateCategoryDto = {
      name: 'Alimentación',
      group_type: TransactionTypeEnum.EXPENSE,
    };

    it('debe crear y guardar categoría exitosamente', async () => {
      const category = buildCategory();
      mockTypeOrmRepo.create.mockReturnValue(category);
      mockTypeOrmRepo.save.mockResolvedValue(category);

      const result = await repo.create(dto);

      expect(mockTypeOrmRepo.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(category);
    });

    it('debe lanzar ConflictException por nombre duplicado (23505)', async () => {
      const pgError = Object.assign(
        Object.create(QueryFailedError.prototype) as QueryFailedError,
        { message: 'duplicate key', code: '23505' },
      );
      mockTypeOrmRepo.create.mockReturnValue(buildCategory());
      mockTypeOrmRepo.save.mockRejectedValue(pgError);

      await expect(repo.create(dto)).rejects.toThrow(ConflictException);
    });

    it('debe lanzar InternalServerErrorException para otros errores', async () => {
      mockTypeOrmRepo.create.mockReturnValue(buildCategory());
      mockTypeOrmRepo.save.mockRejectedValue(new Error('timeout'));

      await expect(repo.create(dto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findAll
  // ─────────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('debe retornar categorías activas', async () => {
      const categories = [
        buildCategory(),
        buildCategory({ id: 2, name: 'Transporte' }),
      ];
      mockTypeOrmRepo.find.mockResolvedValue(categories);

      const result = await repo.findAll();

      expect(mockTypeOrmRepo.find).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(2);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findById
  // ─────────────────────────────────────────────────────────────
  describe('findById', () => {
    it('debe retornar categoría existente', async () => {
      const category = buildCategory();
      mockTypeOrmRepo.findOne.mockResolvedValue(category);

      const result = await repo.findById(1);

      expect(result).toEqual(category);
    });

    it('debe lanzar NotFoundException si no existe', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      await expect(repo.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // update
  // ─────────────────────────────────────────────────────────────
  describe('update', () => {
    it('debe actualizar y guardar la categoría', async () => {
      const category = buildCategory();
      const merged = buildCategory({ name: 'Comida' });
      mockTypeOrmRepo.findOne.mockResolvedValue(category);
      mockTypeOrmRepo.merge.mockReturnValue(merged);
      mockTypeOrmRepo.save.mockResolvedValue(merged);

      const result = await repo.update(1, { name: 'Comida' });

      expect(mockTypeOrmRepo.merge).toHaveBeenCalledWith(category, {
        name: 'Comida',
      });
      expect(result.name).toBe('Comida');
    });

    it('debe propagar NotFoundException si la categoría no existe', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      await expect(repo.update(999, {})).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // softDelete
  // ─────────────────────────────────────────────────────────────
  describe('softDelete', () => {
    it('debe desactivar (is_active=false) y guardar la categoría', async () => {
      const category = buildCategory();
      mockTypeOrmRepo.findOne.mockResolvedValue(category);
      mockTypeOrmRepo.save.mockResolvedValue({ ...category, is_active: false });

      await repo.softDelete(1);

      expect(category.is_active).toBe(false);
      expect(mockTypeOrmRepo.save).toHaveBeenCalledWith(category);
    });

    it('debe propagar NotFoundException si la categoría no existe', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      await expect(repo.softDelete(999)).rejects.toThrow(NotFoundException);
      expect(mockTypeOrmRepo.save).not.toHaveBeenCalled();
    });
  });
});

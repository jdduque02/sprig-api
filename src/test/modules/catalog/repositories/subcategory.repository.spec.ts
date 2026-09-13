import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { QueryFailedError } from 'typeorm';
import { SubcategoryRepository } from '@catalog/repositories/subcategory.repository';
import { Subcategory } from '@catalog/entities/subcategory.entity';
import { CreateSubcategoryDto } from '@catalog/dto/subcategory/create-subcategory.dto';
import { UpdateSubcategoryDto } from '@catalog/dto/subcategory/update-subcategory.dto';

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

const buildSubcategory = (overrides = {}): Subcategory =>
  ({
    id: 1,
    name: 'Supermercado',
    category_id: 1,
    user_id: 10,
    is_active: true,
    ...overrides,
  }) as unknown as Subcategory;

describe('SubcategoryRepository', () => {
  let repo: SubcategoryRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubcategoryRepository,
        { provide: getRepositoryToken(Subcategory), useValue: mockTypeOrmRepo },
        { provide: I18nService, useValue: mockI18nService },
      ],
    }).compile();

    repo = module.get<SubcategoryRepository>(SubcategoryRepository);
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // create
  // ─────────────────────────────────────────────────────────────
  describe('create', () => {
    const dto: CreateSubcategoryDto = { name: 'Supermercado', category_id: 1 };

    it('debe crear y guardar subcategoría exitosamente', async () => {
      const subcategory = buildSubcategory();
      mockTypeOrmRepo.create.mockReturnValue(subcategory);
      mockTypeOrmRepo.save.mockResolvedValue(subcategory);

      const result = await repo.create(10, dto);

      expect(mockTypeOrmRepo.create).toHaveBeenCalledWith({
        ...dto,
        user_id: 10,
      });
      expect(result).toEqual(subcategory);
    });

    it('debe lanzar ConflictException por nombre duplicado (23505)', async () => {
      const pgError = Object.assign(
        Object.create(QueryFailedError.prototype) as QueryFailedError,
        { message: 'duplicate key', code: '23505' },
      );
      mockTypeOrmRepo.create.mockReturnValue(buildSubcategory());
      mockTypeOrmRepo.save.mockRejectedValue(pgError);

      await expect(repo.create(10, dto)).rejects.toThrow(ConflictException);
    });

    it('debe lanzar InternalServerErrorException para otros errores', async () => {
      mockTypeOrmRepo.create.mockReturnValue(buildSubcategory());
      mockTypeOrmRepo.save.mockRejectedValue(new Error('timeout'));

      await expect(repo.create(10, dto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findAll
  // ─────────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('debe retornar subcategorías del usuario sin filtro de categoría', async () => {
      const list = [
        buildSubcategory(),
        buildSubcategory({ id: 2, name: 'Farmacia' }),
      ];
      mockTypeOrmRepo.find.mockResolvedValue(list);

      const result = await repo.findAll(10);

      expect(mockTypeOrmRepo.find).toHaveBeenCalledWith({
        where: { user_id: 10, is_active: true },
        order: { name: 'ASC' },
      });
      expect(result).toHaveLength(2);
    });

    it('debe filtrar por categoryId cuando se provee', async () => {
      const list = [buildSubcategory()];
      mockTypeOrmRepo.find.mockResolvedValue(list);

      const result = await repo.findAll(10, 1);

      expect(mockTypeOrmRepo.find).toHaveBeenCalledWith({
        where: { user_id: 10, is_active: true, category_id: 1 },
        order: { name: 'ASC' },
      });
      expect(result).toHaveLength(1);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findById
  // ─────────────────────────────────────────────────────────────
  describe('findById', () => {
    it('debe retornar la subcategoría existente', async () => {
      const subcategory = buildSubcategory();
      mockTypeOrmRepo.findOne.mockResolvedValue(subcategory);

      const result = await repo.findById(1, 10);

      expect(result).toEqual(subcategory);
    });

    it('debe lanzar NotFoundException si no existe', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      await expect(repo.findById(999, 10)).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // update
  // ─────────────────────────────────────────────────────────────
  describe('update', () => {
    const dto: UpdateSubcategoryDto = { name: 'Mercado' };

    it('debe actualizar y retornar la subcategoría', async () => {
      const existing = buildSubcategory();
      const updated = buildSubcategory({ name: 'Mercado' });
      mockTypeOrmRepo.findOne.mockResolvedValue(existing);
      mockTypeOrmRepo.merge.mockReturnValue(updated);
      mockTypeOrmRepo.save.mockResolvedValue(updated);

      const result = await repo.update(1, 10, dto);

      expect(result.name).toBe('Mercado');
    });

    it('debe lanzar NotFoundException si la subcategoría no existe', async () => {
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
    it('debe desactivar la subcategoría (is_active = false)', async () => {
      const subcategory = buildSubcategory();
      mockTypeOrmRepo.findOne.mockResolvedValue(subcategory);
      mockTypeOrmRepo.save.mockResolvedValue({
        ...subcategory,
        is_active: false,
      });

      await repo.softDelete(1, 10);

      expect(mockTypeOrmRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ is_active: false }),
      );
    });

    it('debe lanzar NotFoundException si no existe la subcategoría', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      await expect(repo.softDelete(999, 10)).rejects.toThrow(NotFoundException);
    });
  });
});

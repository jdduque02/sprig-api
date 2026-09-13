import { ConflictException, NotFoundException } from '@nestjs/common';
import { CategoryController } from '@catalog/controller/category.controller';
import { CategoryService } from '@catalog/service/category.service';
import { CreateCategoryDto } from '@catalog/dto/category/create-category.dto';
import { UpdateCategoryDto } from '@catalog/dto/category/update-category.dto';
import { TransactionTypeEnum } from '@shared/enums';
import { IntrospectResponse } from '@auth/interfaces/IntrospectResponse.dto';

const mockCategoryService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

const buildCategory = (overrides = {}) => ({
  id: 1,
  name: 'Alimentación',
  group_type: TransactionTypeEnum.EXPENSE,
  icon_key: 'food-fork-drink',
  color_hex: '#FF5733',
  is_active: true,
  ...overrides,
});

const currentUser: IntrospectResponse = {
  sub: 'kc-uuid',
  username: 'testuser',
};

describe('CategoryController', () => {
  let controller: CategoryController;

  beforeEach(() => {
    controller = new CategoryController(
      mockCategoryService as unknown as CategoryService,
    );
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

    it('debe crear categoría delegando al servicio', async () => {
      const created = buildCategory();
      mockCategoryService.create.mockResolvedValue(created);

      const result = await controller.create(dto, currentUser);

      expect(mockCategoryService.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(created);
    });

    it('debe propagar ConflictException si ya existe la categoría', async () => {
      mockCategoryService.create.mockRejectedValue(new ConflictException());

      await expect(controller.create(dto, currentUser)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findAll
  // ─────────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('debe retornar todas las categorías activas', async () => {
      const categories = [
        buildCategory(),
        buildCategory({ id: 2, name: 'Transporte' }),
      ];
      mockCategoryService.findAll.mockResolvedValue(categories);

      const result = await controller.findAll(currentUser);

      expect(mockCategoryService.findAll).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(2);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findOne
  // ─────────────────────────────────────────────────────────────
  describe('findOne', () => {
    it('debe retornar categoría por id', async () => {
      const category = buildCategory();
      mockCategoryService.findOne.mockResolvedValue(category);

      const result = await controller.findOne(1, currentUser);

      expect(mockCategoryService.findOne).toHaveBeenCalledWith(1);
      expect(result).toEqual(category);
    });

    it('debe propagar NotFoundException si la categoría no existe', async () => {
      mockCategoryService.findOne.mockRejectedValue(new NotFoundException());

      await expect(controller.findOne(999, currentUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // update
  // ─────────────────────────────────────────────────────────────
  describe('update', () => {
    it('debe actualizar categoría y retornar el resultado', async () => {
      const dto: UpdateCategoryDto = { name: 'Comida' };
      const updated = buildCategory({ name: 'Comida' });
      mockCategoryService.update.mockResolvedValue(updated);

      const result = await controller.update(1, dto, currentUser);

      expect(mockCategoryService.update).toHaveBeenCalledWith(1, dto);
      expect(result).toEqual(updated);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // remove
  // ─────────────────────────────────────────────────────────────
  describe('remove', () => {
    it('debe desactivar la categoría delegando al servicio', async () => {
      mockCategoryService.remove.mockResolvedValue(undefined);

      await controller.remove(1);

      expect(mockCategoryService.remove).toHaveBeenCalledWith(1);
    });

    it('debe propagar NotFoundException si la categoría no existe', async () => {
      mockCategoryService.remove.mockRejectedValue(new NotFoundException());

      await expect(controller.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});

import { NotFoundException } from '@nestjs/common';
import { SubcategoryController } from '@catalog/controller/subcategory.controller';
import { SubcategoryService } from '@catalog/service/subcategory.service';
import { CreateSubcategoryDto } from '@catalog/dto/subcategory/create-subcategory.dto';
import { UpdateSubcategoryDto } from '@catalog/dto/subcategory/update-subcategory.dto';
import { IntrospectResponse } from '@auth/interfaces/IntrospectResponse.dto';

const mockSubcategoryService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

const buildSubcategory = (overrides = {}) => ({
  id: 1,
  user_id: 10,
  category_id: 2,
  name: 'Restaurantes',
  is_active: true,
  ...overrides,
});

const currentUser: IntrospectResponse = {
  sub: 'kc-uuid',
  username: 'testuser',
};

describe('SubcategoryController', () => {
  let controller: SubcategoryController;

  beforeEach(() => {
    controller = new SubcategoryController(
      mockSubcategoryService as unknown as SubcategoryService,
    );
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // create
  // ─────────────────────────────────────────────────────────────
  describe('create', () => {
    const dto: CreateSubcategoryDto = { category_id: 2, name: 'Restaurantes' };

    it('debe crear subcategoría delegando al servicio', async () => {
      const created = buildSubcategory();
      mockSubcategoryService.create.mockResolvedValue(created);

      const result = await controller.create(10, dto, currentUser);

      expect(mockSubcategoryService.create).toHaveBeenCalledWith(10, dto);
      expect(result).toEqual(created);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findAll
  // ─────────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('debe retornar todas las subcategorías del usuario', async () => {
      const subcategories = [buildSubcategory(), buildSubcategory({ id: 2 })];
      mockSubcategoryService.findAll.mockResolvedValue(subcategories);

      const result = await controller.findAll(10, undefined, currentUser);

      expect(mockSubcategoryService.findAll).toHaveBeenCalledWith(
        10,
        undefined,
      );
      expect(result).toHaveLength(2);
    });

    it('debe pasar categoryId como filtro al servicio', async () => {
      mockSubcategoryService.findAll.mockResolvedValue([buildSubcategory()]);

      await controller.findAll(10, 2, currentUser);

      expect(mockSubcategoryService.findAll).toHaveBeenCalledWith(10, 2);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findOne
  // ─────────────────────────────────────────────────────────────
  describe('findOne', () => {
    it('debe retornar subcategoría por id', async () => {
      const sub = buildSubcategory();
      mockSubcategoryService.findOne.mockResolvedValue(sub);

      const result = await controller.findOne(10, 1, currentUser);

      expect(mockSubcategoryService.findOne).toHaveBeenCalledWith(1, 10);
      expect(result).toEqual(sub);
    });

    it('debe propagar NotFoundException si no existe', async () => {
      mockSubcategoryService.findOne.mockRejectedValue(new NotFoundException());

      await expect(controller.findOne(10, 999, currentUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // update
  // ─────────────────────────────────────────────────────────────
  describe('update', () => {
    it('debe actualizar subcategoría y retornar el resultado', async () => {
      const dto: UpdateSubcategoryDto = { name: 'Fast Food' };
      const updated = buildSubcategory({ name: 'Fast Food' });
      mockSubcategoryService.update.mockResolvedValue(updated);

      const result = await controller.update(10, 1, dto, currentUser);

      expect(mockSubcategoryService.update).toHaveBeenCalledWith(1, 10, dto);
      expect(result).toEqual(updated);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // remove
  // ─────────────────────────────────────────────────────────────
  describe('remove', () => {
    it('debe desactivar subcategoría y retornar undefined', async () => {
      mockSubcategoryService.remove.mockResolvedValue(undefined);

      const result = await controller.remove(10, 1, currentUser);

      expect(mockSubcategoryService.remove).toHaveBeenCalledWith(1, 10);
      expect(result).toBeUndefined();
    });

    it('debe propagar NotFoundException si no existe', async () => {
      mockSubcategoryService.remove.mockRejectedValue(new NotFoundException());

      await expect(controller.remove(10, 999, currentUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

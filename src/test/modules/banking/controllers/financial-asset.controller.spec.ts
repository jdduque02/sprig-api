import { NotFoundException } from '@nestjs/common';
import { FinancialAssetController } from '@banking/controller/financial-asset.controller';
import { FinancialAssetService } from '@banking/service/financial-asset.service';
import { CreateFinancialAssetDto } from '@banking/dto/financial-asset/create-financial-asset.dto';
import { UpdateFinancialAssetDto } from '@banking/dto/financial-asset/update-financial-asset.dto';
import { IntrospectResponse } from '@auth/interfaces/IntrospectResponse.dto';

const mockFinancialAssetService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  refreshQuotes: jest.fn(),
};

const buildAsset = (overrides = {}) => ({
  id: 1,
  user_id: 10,
  asset_type: 'acciones',
  name: 'Acciones Ecopetrol',
  current_value: 5000000,
  currency: 'COP',
  created_at: new Date(),
  ...overrides,
});

const currentUser = {
  sub: 'kc-uuid',
  username: 'testuser',
} as unknown as IntrospectResponse;

describe('FinancialAssetController', () => {
  let controller: FinancialAssetController;

  beforeEach(() => {
    controller = new FinancialAssetController(
      mockFinancialAssetService as unknown as FinancialAssetService,
    );
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // create
  // ─────────────────────────────────────────────────────────────
  describe('create', () => {
    const dto: CreateFinancialAssetDto = {
      asset_type: 'acciones',
      name: 'Acciones Ecopetrol',
      current_value: 5000000,
    };

    it('debe crear activo financiero delegando al servicio', async () => {
      const created = buildAsset();
      mockFinancialAssetService.create.mockResolvedValue(created);

      const result = await controller.create(10, dto, currentUser);

      expect(mockFinancialAssetService.create).toHaveBeenCalledWith(10, dto);
      expect(result).toEqual(created);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findAll
  // ─────────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('debe retornar todos los activos del usuario', async () => {
      const list = [buildAsset(), buildAsset({ id: 2, name: 'CDT' })];
      mockFinancialAssetService.findAll.mockResolvedValue(list);

      const result = await controller.findAll(10, currentUser);

      expect(mockFinancialAssetService.findAll).toHaveBeenCalledWith(10);
      expect(result).toHaveLength(2);
    });

    it('debe retornar lista vacía cuando no hay activos', async () => {
      mockFinancialAssetService.findAll.mockResolvedValue([]);

      const result = await controller.findAll(10, currentUser);

      expect(result).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // getQuotes
  // ─────────────────────────────────────────────────────────────
  describe('getQuotes', () => {
    it('debe refrescar cotizaciones delegando al servicio', async () => {
      const quotes = [{ id: 1, symbol: 'EC', quote: 2800 }];
      mockFinancialAssetService.refreshQuotes.mockResolvedValue(quotes);

      const result = await controller.getQuotes(10, currentUser);

      expect(mockFinancialAssetService.refreshQuotes).toHaveBeenCalledWith(10);
      expect(result).toEqual(quotes);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findOne
  // ─────────────────────────────────────────────────────────────
  describe('findOne', () => {
    it('debe retornar el activo por id', async () => {
      const asset = buildAsset();
      mockFinancialAssetService.findOne.mockResolvedValue(asset);

      const result = await controller.findOne(10, 1, currentUser);

      expect(mockFinancialAssetService.findOne).toHaveBeenCalledWith(1, 10);
      expect(result).toEqual(asset);
    });

    it('debe propagar NotFoundException si no existe el activo', async () => {
      mockFinancialAssetService.findOne.mockRejectedValue(
        new NotFoundException(),
      );

      await expect(controller.findOne(10, 999, currentUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // update
  // ─────────────────────────────────────────────────────────────
  describe('update', () => {
    const dto: UpdateFinancialAssetDto = { current_value: 6000000 };

    it('debe actualizar y retornar el activo', async () => {
      const updated = buildAsset({ current_value: 6000000 });
      mockFinancialAssetService.update.mockResolvedValue(updated);

      const result = await controller.update(10, 1, dto, currentUser);

      expect(mockFinancialAssetService.update).toHaveBeenCalledWith(1, 10, dto);
      expect(result.current_value).toBe(6000000);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // remove
  // ─────────────────────────────────────────────────────────────
  describe('remove', () => {
    it('debe eliminar el activo sin excepción', async () => {
      mockFinancialAssetService.remove.mockResolvedValue(undefined);

      await expect(
        controller.remove(10, 1, currentUser),
      ).resolves.toBeUndefined();

      expect(mockFinancialAssetService.remove).toHaveBeenCalledWith(1, 10);
    });

    it('debe propagar NotFoundException si no existe', async () => {
      mockFinancialAssetService.remove.mockRejectedValue(
        new NotFoundException(),
      );

      await expect(controller.remove(10, 999, currentUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

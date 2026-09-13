import { NotFoundException } from '@nestjs/common';
import { FinancialLiabilityController } from '@banking/controller/financial-liability.controller';
import { FinancialLiabilityService } from '@banking/service/financial-liability.service';
import { CreateFinancialLiabilityDto } from '@banking/dto/financial-liability/create-financial-liability.dto';
import { UpdateFinancialLiabilityDto } from '@banking/dto/financial-liability/update-financial-liability.dto';
import { IntrospectResponse } from '@auth/interfaces/IntrospectResponse.dto';

const mockFinancialLiabilityService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

const buildLiability = (overrides = {}) => ({
  id: 1,
  user_id: 10,
  liability_type: 'credito_hipotecario',
  name: 'Crédito vivienda Bancolombia',
  current_balance: 80000000,
  interest_rate: 12.5,
  currency: 'COP',
  created_at: new Date(),
  ...overrides,
});

const currentUser = {
  sub: 'kc-uuid',
  username: 'testuser',
} as unknown as IntrospectResponse;

describe('FinancialLiabilityController', () => {
  let controller: FinancialLiabilityController;

  beforeEach(() => {
    controller = new FinancialLiabilityController(
      mockFinancialLiabilityService as unknown as FinancialLiabilityService,
    );
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // create
  // ─────────────────────────────────────────────────────────────
  describe('create', () => {
    const dto: CreateFinancialLiabilityDto = {
      liability_type: 'credito_hipotecario',
      name: 'Crédito vivienda Bancolombia',
      current_balance: 80000000,
    };

    it('debe crear pasivo financiero delegando al servicio', async () => {
      const created = buildLiability();
      mockFinancialLiabilityService.create.mockResolvedValue(created);

      const result = await controller.create(10, dto, currentUser);

      expect(mockFinancialLiabilityService.create).toHaveBeenCalledWith(
        10,
        dto,
      );
      expect(result).toEqual(created);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findAll
  // ─────────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('debe retornar todos los pasivos del usuario', async () => {
      const list = [
        buildLiability(),
        buildLiability({ id: 2, name: 'Tarjeta crédito' }),
      ];
      mockFinancialLiabilityService.findAll.mockResolvedValue(list);

      const result = await controller.findAll(10, currentUser);

      expect(mockFinancialLiabilityService.findAll).toHaveBeenCalledWith(10);
      expect(result).toHaveLength(2);
    });

    it('debe retornar lista vacía cuando no hay pasivos', async () => {
      mockFinancialLiabilityService.findAll.mockResolvedValue([]);

      const result = await controller.findAll(10, currentUser);

      expect(result).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findOne
  // ─────────────────────────────────────────────────────────────
  describe('findOne', () => {
    it('debe retornar el pasivo por id', async () => {
      const liability = buildLiability();
      mockFinancialLiabilityService.findOne.mockResolvedValue(liability);

      const result = await controller.findOne(10, 1, currentUser);

      expect(mockFinancialLiabilityService.findOne).toHaveBeenCalledWith(1, 10);
      expect(result).toEqual(liability);
    });

    it('debe propagar NotFoundException si no existe', async () => {
      mockFinancialLiabilityService.findOne.mockRejectedValue(
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
    const dto: UpdateFinancialLiabilityDto = { current_balance: 75000000 };

    it('debe actualizar y retornar el pasivo', async () => {
      const updated = buildLiability({ current_balance: 75000000 });
      mockFinancialLiabilityService.update.mockResolvedValue(updated);

      const result = await controller.update(10, 1, dto, currentUser);

      expect(mockFinancialLiabilityService.update).toHaveBeenCalledWith(
        1,
        10,
        dto,
      );
      expect(result.current_balance).toBe(75000000);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // remove
  // ─────────────────────────────────────────────────────────────
  describe('remove', () => {
    it('debe eliminar el pasivo sin excepción', async () => {
      mockFinancialLiabilityService.remove.mockResolvedValue(undefined);

      await expect(
        controller.remove(10, 1, currentUser),
      ).resolves.toBeUndefined();

      expect(mockFinancialLiabilityService.remove).toHaveBeenCalledWith(1, 10);
    });

    it('debe propagar NotFoundException si no existe', async () => {
      mockFinancialLiabilityService.remove.mockRejectedValue(
        new NotFoundException(),
      );

      await expect(controller.remove(10, 999, currentUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

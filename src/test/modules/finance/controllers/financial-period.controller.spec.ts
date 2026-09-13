import { ConflictException, NotFoundException } from '@nestjs/common';
import { FinancialPeriodController } from '@finance/controller/financial-period.controller';
import { FinancialPeriodService } from '@finance/service/financial-period.service';
import { CreateFinancialPeriodDto } from '@finance/dto/financial-period/create-financial-period.dto';
import { IntrospectResponse } from '@auth/interfaces/IntrospectResponse.dto';

const mockFinancialPeriodService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  close: jest.fn(),
};

const buildPeriod = (overrides = {}) => ({
  id: 1,
  user_id: 10,
  year: 2026,
  month: 4,
  is_closed: false,
  ...overrides,
});

const currentUser: IntrospectResponse = { sub: 'kc-uuid' };

describe('FinancialPeriodController', () => {
  let controller: FinancialPeriodController;

  beforeEach(() => {
    controller = new FinancialPeriodController(
      mockFinancialPeriodService as unknown as FinancialPeriodService,
    );
    jest.clearAllMocks();
  });

  describe('create', () => {
    const dto: CreateFinancialPeriodDto = { year: 2026, month: 4 };

    it('debe crear período financiero delegando al servicio', async () => {
      const created = buildPeriod();
      mockFinancialPeriodService.create.mockResolvedValue(created);

      const result = await controller.create(10, dto, currentUser);

      expect(mockFinancialPeriodService.create).toHaveBeenCalledWith(10, dto);
      expect(result).toEqual(created);
    });

    it('debe propagar ConflictException si el período ya existe', async () => {
      mockFinancialPeriodService.create.mockRejectedValue(
        new ConflictException(),
      );

      await expect(controller.create(10, dto, currentUser)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAll', () => {
    it('debe retornar períodos del usuario', async () => {
      const periods = [buildPeriod(), buildPeriod({ id: 2, month: 3 })];
      mockFinancialPeriodService.findAll.mockResolvedValue(periods);

      const result = await controller.findAll(10, currentUser);

      expect(mockFinancialPeriodService.findAll).toHaveBeenCalledWith(10);
      expect(result).toHaveLength(2);
    });
  });

  describe('findOne', () => {
    it('debe retornar período por id', async () => {
      const period = buildPeriod();
      mockFinancialPeriodService.findOne.mockResolvedValue(period);

      const result = await controller.findOne(10, 1, currentUser);

      expect(mockFinancialPeriodService.findOne).toHaveBeenCalledWith(1, 10);
      expect(result).toEqual(period);
    });

    it('debe propagar NotFoundException si no existe', async () => {
      mockFinancialPeriodService.findOne.mockRejectedValue(
        new NotFoundException(),
      );

      await expect(controller.findOne(10, 999, currentUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('close', () => {
    it('debe cerrar el período y retornar el período actualizado', async () => {
      const closed = buildPeriod({ is_closed: true });
      mockFinancialPeriodService.close.mockResolvedValue(closed);

      const result = await controller.close(10, 1, currentUser);

      expect(mockFinancialPeriodService.close).toHaveBeenCalledWith(1, 10);
      expect(result).toEqual(closed);
    });

    it('debe propagar ConflictException si el período ya está cerrado', async () => {
      mockFinancialPeriodService.close.mockRejectedValue(
        new ConflictException(),
      );

      await expect(controller.close(10, 1, currentUser)).rejects.toThrow(
        ConflictException,
      );
    });
  });
});

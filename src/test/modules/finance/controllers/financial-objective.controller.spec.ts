import { NotFoundException } from '@nestjs/common';
import { FinancialObjectiveController } from '@finance/controller/financial-objective.controller';
import { FinancialObjectiveService } from '@finance/service/financial-objective.service';
import { CreateFinancialObjectiveDto } from '@finance/dto/financial-objective/create-financial-objective.dto';
import { UpdateFinancialObjectiveDto } from '@finance/dto/financial-objective/update-financial-objective.dto';
import { CalculateQuotaDto } from '@finance/dto/financial-objective/calculate-quota.dto';
import { FinancialObjectiveTypeEnum } from '@shared/enums';
import { IntrospectResponse } from '@auth/interfaces/IntrospectResponse.dto';

const mockFinancialObjectiveService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  calculateQuota: jest.fn(),
};

const buildObjective = (overrides = {}) => ({
  id: 1,
  user_id: 10,
  name: 'Fondo de emergencia',
  type: FinancialObjectiveTypeEnum.SAVINGS,
  target_amount: 5000000,
  ...overrides,
});

const currentUser: IntrospectResponse = { active: true, sub: 'kc-uuid' };

describe('FinancialObjectiveController', () => {
  let controller: FinancialObjectiveController;

  beforeEach(() => {
    controller = new FinancialObjectiveController(
      mockFinancialObjectiveService as unknown as FinancialObjectiveService,
    );
    jest.clearAllMocks();
  });

  describe('calculateQuota', () => {
    it('debe calcular cuotas delegando al servicio', async () => {
      const dto: CalculateQuotaDto = {
        target_amount: 5000000,
        start_date: '2026-08-01',
      } as CalculateQuotaDto;
      const quota = { monthly_quota: 500000, months: 10 };
      mockFinancialObjectiveService.calculateQuota.mockResolvedValue(quota);

      const result = await controller.calculateQuota(10, dto, currentUser);

      expect(mockFinancialObjectiveService.calculateQuota).toHaveBeenCalledWith(
        10,
        dto,
      );
      expect(result).toEqual(quota);
    });
  });

  describe('create', () => {
    const dto: CreateFinancialObjectiveDto = {
      name: 'Fondo de emergencia',
      type: FinancialObjectiveTypeEnum.SAVINGS,
    };

    it('debe crear objetivo financiero delegando al servicio', async () => {
      const created = buildObjective();
      mockFinancialObjectiveService.create.mockResolvedValue(created);

      const result = await controller.create(10, dto, currentUser);

      expect(mockFinancialObjectiveService.create).toHaveBeenCalledWith(
        10,
        dto,
      );
      expect(result).toEqual(created);
    });
  });

  describe('findAll', () => {
    it('debe retornar objetivos del usuario', async () => {
      const objectives = [buildObjective(), buildObjective({ id: 2 })];
      mockFinancialObjectiveService.findAll.mockResolvedValue(objectives);

      const result = await controller.findAll(10, currentUser);

      expect(mockFinancialObjectiveService.findAll).toHaveBeenCalledWith(10);
      expect(result).toHaveLength(2);
    });
  });

  describe('findOne', () => {
    it('debe retornar objetivo por id', async () => {
      const objective = buildObjective();
      mockFinancialObjectiveService.findOne.mockResolvedValue(objective);

      const result = await controller.findOne(10, 1, currentUser);

      expect(mockFinancialObjectiveService.findOne).toHaveBeenCalledWith(1, 10);
      expect(result).toEqual(objective);
    });

    it('debe propagar NotFoundException si no existe', async () => {
      mockFinancialObjectiveService.findOne.mockRejectedValue(
        new NotFoundException(),
      );

      await expect(controller.findOne(10, 999, currentUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('debe actualizar objetivo y retornar el resultado', async () => {
      const dto: UpdateFinancialObjectiveDto = { name: 'Ahorro navidad' };
      const updated = buildObjective({ name: 'Ahorro navidad' });
      mockFinancialObjectiveService.update.mockResolvedValue(updated);

      const result = await controller.update(10, 1, dto, currentUser);

      expect(mockFinancialObjectiveService.update).toHaveBeenCalledWith(
        1,
        10,
        dto,
      );
      expect(result).toEqual(updated);
    });
  });

  describe('remove', () => {
    it('debe eliminar objetivo y retornar undefined', async () => {
      mockFinancialObjectiveService.remove.mockResolvedValue(undefined);

      const result = await controller.remove(10, 1, currentUser);

      expect(mockFinancialObjectiveService.remove).toHaveBeenCalledWith(1, 10);
      expect(result).toBeUndefined();
    });
  });
});

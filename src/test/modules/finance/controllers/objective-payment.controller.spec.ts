import { NotFoundException } from '@nestjs/common';
import { ObjectivePaymentController } from '@finance/controller/objective-payment.controller';
import { ObjectivePaymentService } from '@finance/service/objective-payment.service';
import { CreateObjectivePaymentDto } from '@finance/dto/objective-payment/create-objective-payment.dto';
import { IntrospectResponse } from '@auth/interfaces/IntrospectResponse.dto';

const mockObjectivePaymentService = {
  create: jest.fn(),
  findByObjective: jest.fn(),
  findOne: jest.fn(),
  remove: jest.fn(),
};

const buildPayment = (overrides = {}) => ({
  id: 1,
  user_id: 10,
  objective_id: 5,
  amount: 200000,
  payment_date: '2026-04-25',
  ...overrides,
});

const currentUser: IntrospectResponse = { sub: 'kc-uuid' };

describe('ObjectivePaymentController', () => {
  let controller: ObjectivePaymentController;

  beforeEach(() => {
    controller = new ObjectivePaymentController(
      mockObjectivePaymentService as unknown as ObjectivePaymentService,
    );
    jest.clearAllMocks();
  });

  describe('create', () => {
    const dto: CreateObjectivePaymentDto = {
      objective_id: 5,
      amount: 200000,
      payment_date: '2026-04-25',
    };

    it('debe registrar abono inyectando objectiveId del path al DTO', async () => {
      const created = buildPayment();
      mockObjectivePaymentService.create.mockResolvedValue(created);

      const result = await controller.create(10, 5, dto, currentUser);

      expect(mockObjectivePaymentService.create).toHaveBeenCalledWith(10, {
        ...dto,
        objective_id: 5,
      });
      expect(result).toEqual(created);
    });
  });

  describe('findAll', () => {
    it('debe retornar abonos del objetivo', async () => {
      const payments = [buildPayment(), buildPayment({ id: 2 })];
      mockObjectivePaymentService.findByObjective.mockResolvedValue(payments);

      const result = await controller.findAll(10, 5, currentUser);

      expect(mockObjectivePaymentService.findByObjective).toHaveBeenCalledWith(
        5,
        10,
      );
      expect(result).toHaveLength(2);
    });
  });

  describe('findOne', () => {
    it('debe retornar abono por id', async () => {
      const payment = buildPayment();
      mockObjectivePaymentService.findOne.mockResolvedValue(payment);

      const result = await controller.findOne(10, 1, currentUser);

      expect(mockObjectivePaymentService.findOne).toHaveBeenCalledWith(1, 10);
      expect(result).toEqual(payment);
    });

    it('debe propagar NotFoundException si no existe', async () => {
      mockObjectivePaymentService.findOne.mockRejectedValue(
        new NotFoundException(),
      );

      await expect(controller.findOne(10, 999, currentUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('debe eliminar abono y retornar undefined', async () => {
      mockObjectivePaymentService.remove.mockResolvedValue(undefined);

      const result = await controller.remove(10, 1, currentUser);

      expect(mockObjectivePaymentService.remove).toHaveBeenCalledWith(1, 10);
      expect(result).toBeUndefined();
    });
  });
});

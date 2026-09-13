import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ObjectivePaymentService } from '@finance/service/objective-payment.service';
import { ObjectivePaymentRepository } from '@finance/repositories/objective-payment.repository';
import { CreateObjectivePaymentDto } from '@finance/dto/objective-payment/create-objective-payment.dto';

const mockObjectivePaymentRepository = {
  create: jest.fn(),
  findByObjective: jest.fn(),
  findById: jest.fn(),
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

describe('ObjectivePaymentService', () => {
  let service: ObjectivePaymentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ObjectivePaymentService,
        {
          provide: ObjectivePaymentRepository,
          useValue: mockObjectivePaymentRepository,
        },
      ],
    }).compile();

    service = module.get<ObjectivePaymentService>(ObjectivePaymentService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('debe delegar la creación al repositorio', async () => {
      const dto: CreateObjectivePaymentDto = {
        objective_id: 5,
        amount: 200000,
        payment_date: '2026-04-25',
      };
      const created = buildPayment();
      mockObjectivePaymentRepository.create.mockResolvedValue(created);

      const result = await service.create(10, dto);

      expect(mockObjectivePaymentRepository.create).toHaveBeenCalledWith(
        10,
        dto,
      );
      expect(result).toEqual(created);
    });
  });

  describe('findByObjective', () => {
    it('debe retornar abonos del objetivo', async () => {
      const payments = [buildPayment(), buildPayment({ id: 2 })];
      mockObjectivePaymentRepository.findByObjective.mockResolvedValue(
        payments,
      );

      const result = await service.findByObjective(5, 10);

      expect(
        mockObjectivePaymentRepository.findByObjective,
      ).toHaveBeenCalledWith(5, 10);
      expect(result).toHaveLength(2);
    });
  });

  describe('findOne', () => {
    it('debe retornar abono por id', async () => {
      const payment = buildPayment();
      mockObjectivePaymentRepository.findById.mockResolvedValue(payment);

      const result = await service.findOne(1, 10);

      expect(mockObjectivePaymentRepository.findById).toHaveBeenCalledWith(
        1,
        10,
      );
      expect(result).toEqual(payment);
    });

    it('debe propagar NotFoundException del repositorio', async () => {
      mockObjectivePaymentRepository.findById.mockRejectedValue(
        new NotFoundException(),
      );

      await expect(service.findOne(999, 10)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('debe delegar la eliminación al repositorio', async () => {
      mockObjectivePaymentRepository.remove.mockResolvedValue(undefined);

      await service.remove(1, 10);

      expect(mockObjectivePaymentRepository.remove).toHaveBeenCalledWith(1, 10);
    });
  });
});

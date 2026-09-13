import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { I18nService } from 'nestjs-i18n';
import { ObjectivePaymentRepository } from '@finance/repositories/objective-payment.repository';
import { ObjectivePayment } from '@finance/entities/objective-payment.entity';
import { FinancialObjective } from '@finance/entities/financial-objective.entity';
import { CreateObjectivePaymentDto } from '@finance/dto/objective-payment/create-objective-payment.dto';

const mockPaymentRepo = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  findOneBy: jest.fn(),
  softRemove: jest.fn(),
};

const mockObjectiveRepo = {
  findOneBy: jest.fn(),
  save: jest.fn(),
};

const mockManager = {
  getRepository: jest.fn((entity) => {
    if (entity === FinancialObjective) return mockObjectiveRepo;
    return mockPaymentRepo;
  }),
};

const mockDataSource = {
  transaction: jest.fn((cb: (manager: typeof mockManager) => unknown) =>
    cb(mockManager),
  ),
};

const mockI18nService = {
  t: jest.fn((key: string) => `[${key}]`),
};

const buildPayment = (overrides = {}): ObjectivePayment =>
  ({
    id: 1,
    user_id: 10,
    objective_id: 5,
    amount: 200,
    payment_date: new Date('2024-01-15'),
    ...overrides,
  }) as unknown as ObjectivePayment;

const buildObjective = (overrides = {}): FinancialObjective =>
  ({
    id: 5,
    user_id: 10,
    target_amount: 1000,
    current_balance: 800,
    is_completed: false,
    completed_at: null,
    ...overrides,
  }) as unknown as FinancialObjective;

describe('ObjectivePaymentRepository', () => {
  let repo: ObjectivePaymentRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ObjectivePaymentRepository,
        {
          provide: getRepositoryToken(ObjectivePayment),
          useValue: mockPaymentRepo,
        },
        { provide: I18nService, useValue: mockI18nService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    repo = module.get<ObjectivePaymentRepository>(ObjectivePaymentRepository);
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // create
  // ─────────────────────────────────────────────────────────────
  describe('create', () => {
    const dto: CreateObjectivePaymentDto = {
      objective_id: 5,
      amount: 200,
      payment_date: '2024-01-15',
    };

    it('debe validar la meta, guardar el pago e incrementar el saldo', async () => {
      const payment = buildPayment();
      const objective = buildObjective({ current_balance: 800 });
      mockObjectiveRepo.findOneBy.mockResolvedValue(objective);
      mockPaymentRepo.create.mockReturnValue(payment);
      mockPaymentRepo.save.mockResolvedValue(payment);

      const result = await repo.create(10, dto);

      expect(mockObjectiveRepo.findOneBy).toHaveBeenCalledWith(
        expect.objectContaining({ id: 5, user_id: 10 }),
      );
      expect(mockPaymentRepo.create).toHaveBeenCalledWith({
        ...dto,
        user_id: 10,
      });
      expect(objective.current_balance).toBe(1000);
      expect(objective.is_completed).toBe(true);
      expect(mockObjectiveRepo.save).toHaveBeenCalledWith(objective);
      expect(result).toEqual(payment);
    });

    it('debe lanzar NotFoundException si la meta no existe o no es del usuario', async () => {
      mockObjectiveRepo.findOneBy.mockResolvedValue(null);

      await expect(repo.create(10, dto)).rejects.toThrow(NotFoundException);
      expect(mockPaymentRepo.save).not.toHaveBeenCalled();
    });

    it('no debe marcar la meta como completada si el saldo no alcanza el objetivo', async () => {
      const payment = buildPayment();
      const objective = buildObjective({ current_balance: 100 });
      mockObjectiveRepo.findOneBy.mockResolvedValue(objective);
      mockPaymentRepo.create.mockReturnValue(payment);
      mockPaymentRepo.save.mockResolvedValue(payment);

      await repo.create(10, dto);

      expect(objective.current_balance).toBe(300);
      expect(objective.is_completed).toBe(false);
    });

    it('trata current_balance y amount nulos como cero', async () => {
      const payment = buildPayment({ amount: null });
      const objective = buildObjective({ current_balance: null });
      mockObjectiveRepo.findOneBy.mockResolvedValue(objective);
      mockPaymentRepo.create.mockReturnValue(payment);
      mockPaymentRepo.save.mockResolvedValue(payment);

      await repo.create(10, { ...dto, amount: null });

      expect(objective.current_balance).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findByObjective
  // ─────────────────────────────────────────────────────────────
  describe('findByObjective', () => {
    it('debe retornar los pagos del objetivo', async () => {
      const list = [buildPayment(), buildPayment({ id: 2, amount: 300 })];
      mockPaymentRepo.find.mockResolvedValue(list);

      const result = await repo.findByObjective(5, 10);

      expect(mockPaymentRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            objective_id: 5,
            user_id: 10,
          }) as Record<string, unknown>,
          order: { payment_date: 'DESC' },
        }),
      );
      expect(result).toHaveLength(2);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findById
  // ─────────────────────────────────────────────────────────────
  describe('findById', () => {
    it('debe retornar el pago existente', async () => {
      const payment = buildPayment();
      mockPaymentRepo.findOne.mockResolvedValue(payment);

      const result = await repo.findById(1, 10);

      expect(result).toEqual(payment);
    });

    it('debe lanzar NotFoundException si no existe', async () => {
      mockPaymentRepo.findOne.mockResolvedValue(null);

      await expect(repo.findById(999, 10)).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // remove
  // ─────────────────────────────────────────────────────────────
  describe('remove', () => {
    it('debe eliminar el pago (soft) y revertir el saldo de la meta', async () => {
      const payment = buildPayment();
      const objective = buildObjective({ current_balance: 1000 });
      mockPaymentRepo.findOneBy.mockResolvedValue(payment);
      mockPaymentRepo.softRemove.mockResolvedValue(payment);
      mockObjectiveRepo.findOneBy.mockResolvedValue(objective);

      await repo.remove(1, 10);

      expect(mockPaymentRepo.findOneBy).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, user_id: 10 }),
      );
      expect(mockPaymentRepo.softRemove).toHaveBeenCalledWith(payment);
      expect(objective.current_balance).toBe(800);
      expect(mockObjectiveRepo.save).toHaveBeenCalledWith(objective);
    });

    it('debe lanzar NotFoundException si no existe el pago', async () => {
      mockPaymentRepo.findOneBy.mockResolvedValue(null);

      await expect(repo.remove(999, 10)).rejects.toThrow(NotFoundException);
    });

    it('no revierte el saldo si la meta ya no existe', async () => {
      const payment = buildPayment();
      mockPaymentRepo.findOneBy.mockResolvedValue(payment);
      mockPaymentRepo.softRemove.mockResolvedValue(payment);
      mockObjectiveRepo.findOneBy.mockResolvedValue(null);

      await repo.remove(1, 10);

      expect(mockPaymentRepo.softRemove).toHaveBeenCalledWith(payment);
      expect(mockObjectiveRepo.save).not.toHaveBeenCalled();
    });

    it('trata current_balance y amount nulos como cero al revertir', async () => {
      const payment = buildPayment({ amount: null });
      const objective = buildObjective({ current_balance: null });
      mockPaymentRepo.findOneBy.mockResolvedValue(payment);
      mockPaymentRepo.softRemove.mockResolvedValue(payment);
      mockObjectiveRepo.findOneBy.mockResolvedValue(objective);

      await repo.remove(1, 10);

      expect(objective.current_balance).toBe(0);
      expect(mockObjectiveRepo.save).toHaveBeenCalledWith(objective);
    });
  });
});

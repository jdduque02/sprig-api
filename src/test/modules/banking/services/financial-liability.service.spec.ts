import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { FinancialLiabilityService } from '@banking/service/financial-liability.service';
import { FinancialLiabilityRepository } from '@banking/repositories/financial-liability.repository';
import { FinancialLiability } from '@banking/entities/financial-liability.entity';

const mockFinancialLiabilityRepository = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
};

const buildLiability = (overrides = {}): FinancialLiability =>
  ({
    id: 1,
    user_id: 10,
    liability_type: 'credito_hipotecario',
    name: 'Crédito vivienda Bancolombia',
    current_balance: 80000000,
    interest_rate: 12.5,
    currency: 'COP',
    ...overrides,
  }) as unknown as FinancialLiability;

describe('FinancialLiabilityService', () => {
  let service: FinancialLiabilityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialLiabilityService,
        {
          provide: FinancialLiabilityRepository,
          useValue: mockFinancialLiabilityRepository,
        },
      ],
    }).compile();

    service = module.get<FinancialLiabilityService>(FinancialLiabilityService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('debe delegar al repositorio y retornar el pasivo creado', async () => {
      const dto = {
        liability_type: 'credito_hipotecario',
        name: 'Crédito vivienda',
        current_balance: 80000000,
      };
      const liability = buildLiability();
      mockFinancialLiabilityRepository.create.mockResolvedValue(liability);

      const result = await service.create(10, dto);

      expect(mockFinancialLiabilityRepository.create).toHaveBeenCalledWith(
        10,
        dto,
      );
      expect(result).toEqual(liability);
    });
  });

  describe('findAll', () => {
    it('debe retornar todos los pasivos del usuario', async () => {
      const list = [
        buildLiability(),
        buildLiability({ id: 2, name: 'Tarjeta crédito' }),
      ];
      mockFinancialLiabilityRepository.findAll.mockResolvedValue(list);

      const result = await service.findAll(10);

      expect(mockFinancialLiabilityRepository.findAll).toHaveBeenCalledWith(10);
      expect(result).toHaveLength(2);
    });
  });

  describe('findOne', () => {
    it('debe retornar el pasivo por id', async () => {
      const liability = buildLiability();
      mockFinancialLiabilityRepository.findById.mockResolvedValue(liability);

      const result = await service.findOne(1, 10);

      expect(mockFinancialLiabilityRepository.findById).toHaveBeenCalledWith(
        1,
        10,
      );
      expect(result).toEqual(liability);
    });

    it('debe propagar NotFoundException del repositorio', async () => {
      mockFinancialLiabilityRepository.findById.mockRejectedValue(
        new NotFoundException(),
      );

      await expect(service.findOne(999, 10)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('debe actualizar y retornar el pasivo', async () => {
      const dto = { current_balance: 75000000 };
      const updated = buildLiability({ current_balance: 75000000 });
      mockFinancialLiabilityRepository.update.mockResolvedValue(updated);

      const result = await service.update(1, 10, dto);

      expect(mockFinancialLiabilityRepository.update).toHaveBeenCalledWith(
        1,
        10,
        dto,
      );
      expect(result.current_balance).toBe(75000000);
    });
  });

  describe('remove', () => {
    it('debe delegar softDelete al repositorio', async () => {
      mockFinancialLiabilityRepository.softDelete.mockResolvedValue(undefined);

      await expect(service.remove(1, 10)).resolves.toBeUndefined();

      expect(mockFinancialLiabilityRepository.softDelete).toHaveBeenCalledWith(
        1,
        10,
      );
    });

    it('debe propagar NotFoundException del repositorio', async () => {
      mockFinancialLiabilityRepository.softDelete.mockRejectedValue(
        new NotFoundException(),
      );

      await expect(service.remove(999, 10)).rejects.toThrow(NotFoundException);
    });
  });
});

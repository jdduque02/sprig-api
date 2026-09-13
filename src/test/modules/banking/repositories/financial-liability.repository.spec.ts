import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { FinancialLiabilityRepository } from '@banking/repositories/financial-liability.repository';
import { FinancialLiability } from '@banking/entities/financial-liability.entity';
import { CreateFinancialLiabilityDto } from '@banking/dto/financial-liability/create-financial-liability.dto';
import { UpdateFinancialLiabilityDto } from '@banking/dto/financial-liability/update-financial-liability.dto';

const mockTypeOrmRepo = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  merge: jest.fn(),
  softRemove: jest.fn(),
};

const mockI18nService = {
  t: jest.fn((key: string) => `[${key}]`),
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
    deleted_at: null,
    created_at: new Date(),
    ...overrides,
  }) as unknown as FinancialLiability;

describe('FinancialLiabilityRepository', () => {
  let repo: FinancialLiabilityRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialLiabilityRepository,
        {
          provide: getRepositoryToken(FinancialLiability),
          useValue: mockTypeOrmRepo,
        },
        { provide: I18nService, useValue: mockI18nService },
      ],
    }).compile();

    repo = module.get<FinancialLiabilityRepository>(
      FinancialLiabilityRepository,
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

    it('debe crear y guardar el pasivo exitosamente', async () => {
      const liability = buildLiability();
      mockTypeOrmRepo.create.mockReturnValue(liability);
      mockTypeOrmRepo.save.mockResolvedValue(liability);

      const result = await repo.create(10, dto);

      expect(mockTypeOrmRepo.create).toHaveBeenCalledWith({
        ...dto,
        user_id: 10,
      });
      expect(result).toEqual(liability);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findAll
  // ─────────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('debe retornar pasivos del usuario sin soft-delete', async () => {
      const list = [
        buildLiability(),
        buildLiability({ id: 2, name: 'Tarjeta crédito' }),
      ];
      mockTypeOrmRepo.find.mockResolvedValue(list);

      const result = await repo.findAll(10);

      expect(mockTypeOrmRepo.find).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(2);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findById
  // ─────────────────────────────────────────────────────────────
  describe('findById', () => {
    it('debe retornar el pasivo existente', async () => {
      const liability = buildLiability();
      mockTypeOrmRepo.findOne.mockResolvedValue(liability);

      const result = await repo.findById(1, 10);

      expect(result).toEqual(liability);
    });

    it('debe lanzar NotFoundException si no existe', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      await expect(repo.findById(999, 10)).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // update
  // ─────────────────────────────────────────────────────────────
  describe('update', () => {
    const dto: UpdateFinancialLiabilityDto = { current_balance: 75000000 };

    it('debe actualizar y retornar el pasivo', async () => {
      const existing = buildLiability();
      const updated = buildLiability({ current_balance: 75000000 });
      mockTypeOrmRepo.findOne.mockResolvedValue(existing);
      mockTypeOrmRepo.merge.mockReturnValue(updated);
      mockTypeOrmRepo.save.mockResolvedValue(updated);

      const result = await repo.update(1, 10, dto);

      expect(result.current_balance).toBe(75000000);
    });

    it('debe lanzar NotFoundException si no existe', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      await expect(repo.update(999, 10, dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // softDelete
  // ─────────────────────────────────────────────────────────────
  describe('softDelete', () => {
    it('debe ejecutar softRemove sobre el pasivo', async () => {
      const liability = buildLiability();
      mockTypeOrmRepo.findOne.mockResolvedValue(liability);
      mockTypeOrmRepo.softRemove.mockResolvedValue(undefined);

      await repo.softDelete(1, 10);

      expect(mockTypeOrmRepo.softRemove).toHaveBeenCalledWith(liability);
    });

    it('debe lanzar NotFoundException si no existe el pasivo', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      await expect(repo.softDelete(999, 10)).rejects.toThrow(NotFoundException);
    });
  });
});

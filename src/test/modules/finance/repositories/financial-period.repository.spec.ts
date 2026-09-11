import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { FinancialPeriodRepository } from '@finance/repositories/financial-period.repository';
import { FinancialPeriod } from '@finance/entities/financial-period.entity';
import { CreateFinancialPeriodDto } from '@finance/dto/financial-period/create-financial-period.dto';

const mockTypeOrmRepo = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
};

const mockI18nService = {
  t: jest.fn((key: string) => `[${key}]`),
};

const buildPeriod = (overrides = {}): FinancialPeriod =>
  ({
    id: 1,
    user_id: 10,
    year: 2024,
    month: 1,
    is_closed: false,
    closed_at: null,
    ...overrides,
  }) as unknown as FinancialPeriod;

describe('FinancialPeriodRepository', () => {
  let repo: FinancialPeriodRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialPeriodRepository,
        {
          provide: getRepositoryToken(FinancialPeriod),
          useValue: mockTypeOrmRepo,
        },
        { provide: I18nService, useValue: mockI18nService },
      ],
    }).compile();

    repo = module.get<FinancialPeriodRepository>(FinancialPeriodRepository);
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // create
  // ─────────────────────────────────────────────────────────────
  describe('create', () => {
    const dto: CreateFinancialPeriodDto = { year: 2024, month: 1 };

    it('debe crear y guardar el período exitosamente', async () => {
      const period = buildPeriod();
      mockTypeOrmRepo.findOne.mockResolvedValue(null); // no existe aún
      mockTypeOrmRepo.create.mockReturnValue(period);
      mockTypeOrmRepo.save.mockResolvedValue(period);

      const result = await repo.create(10, dto);

      expect(mockTypeOrmRepo.create).toHaveBeenCalledWith({
        ...dto,
        user_id: 10,
      });
      expect(result).toEqual(period);
    });

    it('debe lanzar ConflictException si el período ya existe', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(buildPeriod()); // ya existe

      await expect(repo.create(10, dto)).rejects.toThrow(ConflictException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findAll
  // ─────────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('debe retornar períodos del usuario ordenados', async () => {
      const list = [
        buildPeriod(),
        buildPeriod({ id: 2, year: 2024, month: 2 }),
      ];
      mockTypeOrmRepo.find.mockResolvedValue(list);

      const result = await repo.findAll(10);

      expect(mockTypeOrmRepo.find).toHaveBeenCalledWith({
        where: { user_id: 10 },
        order: { year: 'DESC', month: 'DESC' },
      });
      expect(result).toHaveLength(2);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findById
  // ─────────────────────────────────────────────────────────────
  describe('findById', () => {
    it('debe retornar el período existente', async () => {
      const period = buildPeriod();
      mockTypeOrmRepo.findOne.mockResolvedValue(period);

      const result = await repo.findById(1, 10);

      expect(result).toEqual(period);
    });

    it('debe lanzar NotFoundException si no existe', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      await expect(repo.findById(999, 10)).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // close
  // ─────────────────────────────────────────────────────────────
  describe('close', () => {
    it('debe cerrar el período y establecer closed_at', async () => {
      const period = buildPeriod({ is_closed: false });
      const closed = buildPeriod({ is_closed: true, closed_at: new Date() });
      mockTypeOrmRepo.findOne.mockResolvedValue(period);
      mockTypeOrmRepo.save.mockResolvedValue(closed);

      const result = await repo.close(1, 10);

      expect(result.is_closed).toBe(true);
      expect(mockTypeOrmRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ is_closed: true }),
      );
    });

    it('debe lanzar ConflictException si el período ya está cerrado', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(
        buildPeriod({ is_closed: true }),
      );

      await expect(repo.close(1, 10)).rejects.toThrow(ConflictException);
    });

    it('debe lanzar NotFoundException si el período no existe', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      await expect(repo.close(999, 10)).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findByYearMonth
  // ─────────────────────────────────────────────────────────────
  describe('findByYearMonth', () => {
    it('debe retornar el período si existe', async () => {
      const period = buildPeriod();
      mockTypeOrmRepo.findOne.mockResolvedValue(period);

      const result = await repo.findByYearMonth(10, 2024, 1);

      expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
        where: { user_id: 10, year: 2024, month: 1 },
      });
      expect(result).toEqual(period);
    });

    it('debe retornar null si no existe', async () => {
      mockTypeOrmRepo.findOne.mockResolvedValue(null);

      const result = await repo.findByYearMonth(10, 2024, 1);

      expect(result).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findOrCreateCurrent
  // ─────────────────────────────────────────────────────────────
  describe('findOrCreateCurrent', () => {
    it('debe retornar el período existente sin crear uno nuevo', async () => {
      const period = buildPeriod();
      mockTypeOrmRepo.findOne.mockResolvedValue(period);

      const result = await repo.findOrCreateCurrent(10, 2024, 1);

      expect(result).toEqual(period);
      expect(mockTypeOrmRepo.create).not.toHaveBeenCalled();
    });

    it('debe crear el período si no existe', async () => {
      const created = buildPeriod();
      mockTypeOrmRepo.findOne.mockResolvedValue(null);
      mockTypeOrmRepo.create.mockReturnValue(created);
      mockTypeOrmRepo.save.mockResolvedValue(created);

      const result = await repo.findOrCreateCurrent(10, 2024, 1);

      expect(mockTypeOrmRepo.create).toHaveBeenCalledWith({
        year: 2024,
        month: 1,
        user_id: 10,
      });
      expect(result).toEqual(created);
    });

    it('re-consulta y retorna el período ganador si create() falla por una carrera concurrente', async () => {
      const raceWinner = buildPeriod();
      mockTypeOrmRepo.findOne
        .mockResolvedValueOnce(null) // findByYearMonth inicial: no existe
        .mockResolvedValueOnce(null) // dentro de create(): tampoco existe aún
        .mockResolvedValueOnce(raceWinner); // re-consulta tras el fallo: ya existe
      mockTypeOrmRepo.create.mockReturnValue({});
      mockTypeOrmRepo.save.mockRejectedValue(new Error('duplicate key value'));

      const result = await repo.findOrCreateCurrent(10, 2024, 1);

      expect(result).toEqual(raceWinner);
    });

    it('propaga el error original si tras el fallo tampoco existe el período', async () => {
      const dbError = new Error('duplicate key value');
      mockTypeOrmRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mockTypeOrmRepo.create.mockReturnValue({});
      mockTypeOrmRepo.save.mockRejectedValue(dbError);

      await expect(repo.findOrCreateCurrent(10, 2024, 1)).rejects.toThrow(
        dbError,
      );
    });
  });
});

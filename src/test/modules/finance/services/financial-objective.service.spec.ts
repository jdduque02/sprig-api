import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { FinancialObjectiveService } from '@finance/service/financial-objective.service';
import { FinancialObjectiveRepository } from '@finance/repositories/financial-objective.repository';
import { FinancialProfileRepository } from '@identity/repositories/financial-profile.repository';
import { UserRepository } from '@identity/repositories/app-user.repositories';
import { AuditLogService } from '@audit/service/audit-log.service';
import { CreateFinancialObjectiveDto } from '@finance/dto/financial-objective/create-financial-objective.dto';
import { UpdateFinancialObjectiveDto } from '@finance/dto/financial-objective/update-financial-objective.dto';
import { FinancialObjectiveTypeEnum } from '@shared/enums';

const mockFinancialObjectiveRepository = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
  resolveAccountForQuota: jest.fn(),
};

const mockFinancialProfileRepository = {
  findByUserId: jest.fn(),
};

const mockUserRepository = {
  findById: jest.fn(),
};

const mockAuditLogService = {
  log: jest.fn(),
  write: jest.fn().mockResolvedValue(undefined),
};

const mockI18nService = {
  t: jest.fn((key: string) => `[${key}]`),
};

const buildObjective = (overrides = {}) => ({
  id: 1,
  user_id: 10,
  name: 'Fondo de emergencia',
  type: FinancialObjectiveTypeEnum.SAVINGS,
  target_amount: 5000000,
  ...overrides,
});

describe('FinancialObjectiveService', () => {
  let service: FinancialObjectiveService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialObjectiveService,
        {
          provide: FinancialObjectiveRepository,
          useValue: mockFinancialObjectiveRepository,
        },
        {
          provide: FinancialProfileRepository,
          useValue: mockFinancialProfileRepository,
        },
        { provide: UserRepository, useValue: mockUserRepository },
        { provide: AuditLogService, useValue: mockAuditLogService },
        { provide: I18nService, useValue: mockI18nService },
      ],
    }).compile();

    service = module.get<FinancialObjectiveService>(FinancialObjectiveService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('debe delegar la creación al repositorio', async () => {
      const dto: CreateFinancialObjectiveDto = {
        name: 'Fondo de emergencia',
        type: FinancialObjectiveTypeEnum.SAVINGS,
      } as CreateFinancialObjectiveDto;
      const created = buildObjective();
      mockFinancialObjectiveRepository.create.mockResolvedValue(created);

      const result = await service.create(10, dto);

      expect(mockFinancialObjectiveRepository.create).toHaveBeenCalledWith(
        10,
        dto,
      );
      expect(result).toEqual(created);
    });
  });

  describe('findAll', () => {
    it('debe retornar objetivos del usuario', async () => {
      const objectives = [buildObjective(), buildObjective({ id: 2 })];
      mockFinancialObjectiveRepository.findAll.mockResolvedValue(objectives);

      const result = await service.findAll(10);

      expect(mockFinancialObjectiveRepository.findAll).toHaveBeenCalledWith(10);
      expect(result).toHaveLength(2);
    });
  });

  describe('findOne', () => {
    it('debe retornar objetivo por id', async () => {
      const objective = buildObjective();
      mockFinancialObjectiveRepository.findById.mockResolvedValue(objective);

      const result = await service.findOne(1, 10);

      expect(mockFinancialObjectiveRepository.findById).toHaveBeenCalledWith(
        1,
        10,
      );
      expect(result).toEqual(objective);
    });

    it('debe propagar NotFoundException del repositorio', async () => {
      mockFinancialObjectiveRepository.findById.mockRejectedValue(
        new NotFoundException(),
      );

      await expect(service.findOne(999, 10)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('debe delegar la actualización al repositorio', async () => {
      const dto: UpdateFinancialObjectiveDto = { name: 'Ahorro viaje' };
      const updated = buildObjective({ name: 'Ahorro viaje' });
      mockFinancialObjectiveRepository.update.mockResolvedValue(updated);

      const result = await service.update(1, 10, dto);

      expect(mockFinancialObjectiveRepository.update).toHaveBeenCalledWith(
        1,
        10,
        dto,
      );
      expect(result).toEqual(updated);
    });
  });

  describe('remove', () => {
    it('debe delegar el soft delete al repositorio', async () => {
      mockFinancialObjectiveRepository.softDelete.mockResolvedValue(undefined);

      await service.remove(1, 10);

      expect(mockFinancialObjectiveRepository.softDelete).toHaveBeenCalledWith(
        1,
        10,
      );
    });
  });

  describe('calculateQuota', () => {
    it('mensual: usa meses calendario y días por periodo', async () => {
      const result = await service.calculateQuota(10, {
        target_amount: 1000000,
        current_balance: 0,
        start_date: '2026-01-01',
        end_date: '2027-12-31',
        frequency: 'monthly' as never,
      });

      expect(result.total_periods).toBe(24);
      expect(result.days_in_period).toBe(31);
      expect(result.quota_amount).toBe(41666.67);
    });

    it('weekly: calcula cuotas por semana completa', async () => {
      const result = await service.calculateQuota(10, {
        target_amount: 100000,
        current_balance: 0,
        start_date: '2026-01-01',
        end_date: '2026-01-28',
        frequency: 'weekly' as never,
      });

      expect(result.total_periods).toBe(4);
      expect(result.days_in_period).toBe(7);
      expect(result.quota_amount).toBe(25000);
    });

    it('sin end_date retorna recomendación sin calcular cuotas', async () => {
      const result = await service.calculateQuota(10, {
        target_amount: 1000000,
        frequency: 'monthly' as never,
      });

      expect(result.total_periods).toBe(0);
      expect(result.quota_amount).toBe(0);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('sin target_amount retorna respuesta abierta sin calcular cuotas', async () => {
      const result = await service.calculateQuota(10, {
        target_amount: undefined,
        current_balance: 0,
        frequency: 'monthly' as never,
      });

      expect(result.total_periods).toBe(0);
      expect(result.quota_amount).toBe(0);
      expect(result.target_amount).toBeNull();
      expect(result.amount_to_save).toBeNull();
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('rechaza rango de fechas inválido', async () => {
      await expect(
        service.calculateQuota(10, {
          target_amount: 1000000,
          start_date: '2026-02-01',
          end_date: '2026-01-01',
          frequency: 'monthly' as never,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza objetivo ya alcanzado cuando el saldo cubre la meta', async () => {
      await expect(
        service.calculateQuota(10, {
          target_amount: 500000,
          current_balance: 900000,
          start_date: '2026-01-01',
          end_date: '2026-12-31',
          frequency: 'monthly' as never,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('mensual con día de fin menor al de inicio cuenta un periodo parcial', async () => {
      const result = await service.calculateQuota(10, {
        target_amount: 1000000,
        current_balance: 0,
        start_date: '2026-01-15',
        end_date: '2026-02-10',
        frequency: 'monthly' as never,
      });

      expect(result.total_periods).toBe(1);
      expect(result.days_in_period).toBe(26);
      expect(result.quota_amount).toBe(1000000);
    });

    it('usa perfil financiero y presupuesto dentro de la regla 50-30-20', async () => {
      mockFinancialProfileRepository.findByUserId.mockResolvedValueOnce({
        monthly_income: '6000000',
      });
      mockUserRepository.findById.mockResolvedValueOnce({
        timezone: 'America/Bogota',
      });

      const result = await service.calculateQuota(10, {
        target_amount: 12000000,
        current_balance: 0,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        frequency: 'monthly' as never,
      });

      expect(result.has_financial_profile).toBe(true);
      expect(result.monthly_income).toBe('6000000');
      expect(result.savings_ratio).toBe(20);
      expect(result.max_allowed_per_period).toBe(1200000);
      expect(result.is_within_budget).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('agrega advertencia y recomendación cuando la cuota excede el presupuesto', async () => {
      mockFinancialProfileRepository.findByUserId.mockResolvedValueOnce({
        monthly_income: '1200000',
        savings_ratio: 10,
      });
      mockUserRepository.findById.mockResolvedValueOnce({});

      const result = await service.calculateQuota(10, {
        target_amount: 12000000,
        current_balance: 0,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        frequency: 'monthly' as never,
      });

      expect(result.is_within_budget).toBe(false);
      expect(result.warnings.length).toBe(1);
      expect(result.warnings[0]).toContain('excede');
      expect(result.recommendations).toContain(
        '[finance.REDUCE_OR_EXTEND_RECOMMENDATION]',
      );
    });

    it('sin perfil financiero recomienda registrar ingreso y cargar perfil', async () => {
      mockFinancialProfileRepository.findByUserId.mockRejectedValueOnce(
        new Error('no profile'),
      );

      const result = await service.calculateQuota(10, {
        target_amount: 1000000,
        current_balance: 0,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        frequency: 'monthly' as never,
      });

      expect(result.has_financial_profile).toBe(false);
      expect(result.recommendations).toContain(
        '[finance.REGISTER_INCOME_RECOMMENDATION]',
      );
      expect(result.recommendations).toContain(
        '[finance.LOAD_PROFILE_RECOMMENDATION]',
      );
    });

    it('usa la tasa de la cuenta bancaria para proyectar el saldo', async () => {
      mockFinancialObjectiveRepository.resolveAccountForQuota.mockResolvedValueOnce(
        { bank: 'Banco de Prueba', annual_interest_rate: 5 },
      );

      const result = await service.calculateQuota(10, {
        target_amount: 6000000,
        current_balance: 0,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        frequency: 'monthly' as never,
        account_id: 1,
      });

      expect(result.bank).toBe('Banco de Prueba');
      expect(result.current_profitability).toBe(5);
      expect(result.projected_final_balance).not.toBeNull();
      expect(result.projected_final_balance).toBeGreaterThan(6000000);
      expect(
        result.recommendations.some((r) => r.includes('tasa anual del 5%')),
      ).toBe(true);
    });

    it('proyecta el saldo sin saldo inicial cuando hay tasa de interés', async () => {
      const result = await service.calculateQuota(10, {
        target_amount: 6000000,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        frequency: 'monthly' as never,
        interest_rate: 5,
      });

      expect(result.current_balance).toBe(0);
      expect(result.current_profitability).toBe(5);
      expect(result.projected_final_balance).not.toBeNull();
      expect(result.projected_final_balance).toBeGreaterThan(6000000);
    });

    it('mantiene la tasa explícita del dto por encima de la de la cuenta', async () => {
      mockFinancialObjectiveRepository.resolveAccountForQuota.mockResolvedValueOnce(
        { bank: 'Banco Y', annual_interest_rate: 5 },
      );

      const result = await service.calculateQuota(10, {
        target_amount: 6000000,
        current_balance: 0,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        frequency: 'monthly' as never,
        interest_rate: 10,
        account_id: 1,
      });

      expect(result.bank).toBe('Banco Y');
      expect(result.current_profitability).toBe(10);
    });

    it('no usa la tasa de la cuenta si la cuenta no tiene interés configurado', async () => {
      mockFinancialObjectiveRepository.resolveAccountForQuota.mockResolvedValueOnce(
        { bank: 'Banco Z', annual_interest_rate: null },
      );

      const result = await service.calculateQuota(10, {
        target_amount: 6000000,
        current_balance: 0,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        frequency: 'monthly' as never,
        account_id: 2,
      });

      expect(result.bank).toBe('Banco Z');
      expect(result.current_profitability).toBeNull();
      expect(result.projected_final_balance).toBeNull();
    });

    it('ignora la cuenta cuando no existe', async () => {
      mockFinancialObjectiveRepository.resolveAccountForQuota.mockResolvedValueOnce(
        null,
      );

      const result = await service.calculateQuota(10, {
        target_amount: 1000000,
        current_balance: 0,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        frequency: 'monthly' as never,
        account_id: 999,
      });

      expect(result.bank).toBeNull();
      expect(result.current_profitability).toBeNull();
    });

    it('usa zona horaria por defecto si el usuario no tiene una definida', async () => {
      mockUserRepository.findById.mockResolvedValueOnce({});

      const result = await service.calculateQuota(10, {
        target_amount: 1000000,
        current_balance: 0,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        frequency: 'monthly' as never,
      });

      expect(result.total_periods).toBe(12);
    });

    it('devuelve el resultado aunque falle el registro del audit log', async () => {
      mockAuditLogService.write.mockRejectedValueOnce(new Error('db down'));

      const result = await service.calculateQuota(10, {
        target_amount: 1000000,
        current_balance: 0,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        frequency: 'monthly' as never,
      });

      expect(result.total_periods).toBe(12);
      expect(result.quota_amount).toBe(83333.33);
    });
  });
});

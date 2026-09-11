import { ConflictException, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { FinancialSummaryCalculatorService } from '@intelligence/service/financial-summary-calculator.service';

const mockI18n = { t: jest.fn((key: string) => key) };

const financialSummaryRepo = {
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn((data: unknown) => data),
};

const transactionRecordService = { getSummary: jest.fn() };
const financialObjectiveService = { findAll: jest.fn() };
const financialPeriodService = {
  findOne: jest.fn(),
  findOrCreateCurrent: jest.fn(),
};
const bankAccountService = { findAll: jest.fn() };
const financialAssetService = { findAll: jest.fn() };
const financialLiabilityService = { findAll: jest.fn() };
const financialProfileService = { findByUserId: jest.fn() };

const buildPeriod = (overrides = {}) => ({
  id: 5,
  user_id: 10,
  year: 2026,
  month: 4,
  is_closed: false,
  ...overrides,
});

const buildProfile = (overrides = {}) => ({
  id: '1',
  user_id: '10',
  needs_ratio: 50,
  wants_ratio: 30,
  savings_ratio: 20,
  investment_ratio: 10,
  max_debt_ratio: 40,
  ...overrides,
});

const buildTxSummary = (overrides = {}) => ({
  date_from: '2026-04-01',
  date_to: '2026-04-30',
  group_by: 'month' as const,
  totals: { income: 5000000, expenses: 3000000, investments: 0, count: 10 },
  by_category: [],
  series: [],
  ...overrides,
});

describe('FinancialSummaryCalculatorService', () => {
  let service: FinancialSummaryCalculatorService;

  beforeEach(() => {
    jest.clearAllMocks();
    financialPeriodService.findOrCreateCurrent.mockResolvedValue(buildPeriod());
    financialProfileService.findByUserId.mockResolvedValue(buildProfile());
    transactionRecordService.getSummary.mockResolvedValue(buildTxSummary());
    bankAccountService.findAll.mockResolvedValue([]);
    financialAssetService.findAll.mockResolvedValue([]);
    financialLiabilityService.findAll.mockResolvedValue([]);
    financialObjectiveService.findAll.mockResolvedValue([]);
    financialSummaryRepo.findOne.mockResolvedValue(null);
    financialSummaryRepo.save.mockImplementation((data: unknown) => data);

    service = new FinancialSummaryCalculatorService(
      financialSummaryRepo as never,
      transactionRecordService as never,
      financialObjectiveService as never,
      financialPeriodService as never,
      bankAccountService as never,
      financialAssetService as never,
      financialLiabilityService as never,
      financialProfileService as never,
      mockI18n as unknown as I18nService,
    );
  });

  describe('calculateAndPersist', () => {
    it('calcula ratios y patrimonio correctamente', async () => {
      bankAccountService.findAll.mockResolvedValue([
        { display_balance: '1000000' },
      ]);
      financialAssetService.findAll.mockResolvedValue([
        { current_value: 500000 },
      ]);
      financialLiabilityService.findAll.mockResolvedValue([
        { current_balance: 200000 },
      ]);

      const result = await service.calculateAndPersist(10);

      expect(result.total_income).toBe(5000000);
      expect(result.total_expense).toBe(3000000);
      expect(result.total_debt).toBe(200000);
      expect(result.net_worth).toBe(1000000 + 500000 - 200000);
      expect(result.expense_ratio).toBe(60);
      expect(result.savings_rate).toBe(40);
      expect(result.debt_ratio).toBe(4);
      expect(result.recommended_max_expense).toBe(4000000);
      expect(result.recommended_savings).toBe(1000000);
      expect(result.is_over_spending).toBe(false);
      expect(result.is_over_indebted).toBe(false);
    });

    it('deja los ratios en null cuando el ingreso es 0', async () => {
      transactionRecordService.getSummary.mockResolvedValue(
        buildTxSummary({
          totals: { income: 0, expenses: 0, investments: 0, count: 0 },
        }),
      );

      const result = await service.calculateAndPersist(10);

      expect(result.expense_ratio).toBeNull();
      expect(result.savings_rate).toBeNull();
      expect(result.debt_ratio).toBeNull();
      expect(Number.isNaN(result.recommended_max_expense)).toBe(false);
      expect(Number.isFinite(result.recommended_max_expense)).toBe(true);
    });

    it('lanza ConflictException si ya existe un resumen final para el período', async () => {
      financialSummaryRepo.findOne.mockResolvedValue({
        id: 1,
        is_final: true,
      });

      await expect(service.calculateAndPersist(10)).rejects.toThrow(
        ConflictException,
      );
      expect(financialSummaryRepo.save).not.toHaveBeenCalled();
    });

    it('lanza NotFoundException si el usuario no tiene perfil financiero', async () => {
      financialProfileService.findByUserId.mockRejectedValue(
        new NotFoundException(),
      );

      await expect(service.calculateAndPersist(10)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('propaga (sin enmascarar) un error que no sea NotFoundException al resolver el perfil', async () => {
      const infraError = new Error('conexión a la base de datos perdida');
      financialProfileService.findByUserId.mockRejectedValue(infraError);

      await expect(service.calculateAndPersist(10)).rejects.toThrow(infraError);
    });

    it('actualiza el resumen existente no final en vez de crear uno nuevo', async () => {
      const existing = { id: 7, is_final: false, user_id: 10 };
      financialSummaryRepo.findOne.mockResolvedValue(existing);

      await service.calculateAndPersist(10);

      expect(financialSummaryRepo.create).not.toHaveBeenCalled();
      expect(financialSummaryRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 7 }),
      );
    });

    it('genera insight objective_at_risk para metas atrasadas', async () => {
      financialObjectiveService.findAll.mockResolvedValue([
        {
          id: 1,
          name: 'Vacaciones',
          category_id: 3,
          is_completed: false,
          end_date: '2026-05-01',
          progress_percent: 40,
          days_remaining: 10,
        },
      ]);

      const result = await service.calculateAndPersist(10);

      expect(result.insights).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'objective_at_risk' }),
        ]),
      );
    });

    it('genera insight overspending cuando el gasto supera el máximo recomendado', async () => {
      transactionRecordService.getSummary.mockResolvedValue(
        buildTxSummary({
          totals: {
            income: 5000000,
            expenses: 4500000,
            investments: 0,
            count: 10,
          },
        }),
      );

      const result = await service.calculateAndPersist(10);

      expect(result.is_over_spending).toBe(true);
      expect(result.insights).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'overspending' }),
        ]),
      );
    });

    it('genera insight over_indebted cuando la deuda supera el umbral del perfil', async () => {
      financialLiabilityService.findAll.mockResolvedValue([
        { current_balance: 4000000 },
      ]);

      const result = await service.calculateAndPersist(10);

      expect(result.is_over_indebted).toBe(true);
      expect(result.insights).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'over_indebted' }),
        ]),
      );
    });

    it('genera insight low_savings cuando el ahorro está por debajo del perfil', async () => {
      transactionRecordService.getSummary.mockResolvedValue(
        buildTxSummary({
          totals: {
            income: 5000000,
            expenses: 4700000,
            investments: 0,
            count: 10,
          },
        }),
      );

      const result = await service.calculateAndPersist(10);

      expect(result.insights).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'low_savings' }),
        ]),
      );
    });

    it('genera insight objective_at_risk sin category_id cuando la meta no tiene categoría', async () => {
      financialObjectiveService.findAll.mockResolvedValue([
        {
          id: 1,
          name: 'Fondo de emergencia',
          category_id: null,
          is_completed: false,
          end_date: '2026-05-01',
          progress_percent: 40,
          days_remaining: 10,
        },
      ]);

      const result = await service.calculateAndPersist(10);

      const insight = result.insights.find(
        (i) => i.type === 'objective_at_risk',
      );
      expect(insight?.category_id).toBeUndefined();
    });

    it('no genera insight objective_at_risk para metas dentro del umbral', async () => {
      financialObjectiveService.findAll.mockResolvedValue([
        {
          id: 1,
          name: 'Vacaciones',
          category_id: 3,
          is_completed: false,
          end_date: '2026-12-01',
          progress_percent: 90,
          days_remaining: 200,
        },
      ]);

      const result = await service.calculateAndPersist(10);

      expect(result.insights.some((i) => i.type === 'objective_at_risk')).toBe(
        false,
      );
    });

    it('usa el período indicado por periodId en vez del actual', async () => {
      financialPeriodService.findOne.mockResolvedValue(buildPeriod({ id: 9 }));

      await service.calculateAndPersist(10, { periodId: 9 });

      expect(financialPeriodService.findOne).toHaveBeenCalledWith(9, 10);
      expect(financialPeriodService.findOrCreateCurrent).not.toHaveBeenCalled();
    });

    it('usa el período ya resuelto por el caller sin volver a consultarlo', async () => {
      const period = buildPeriod({ id: 9 });

      await service.calculateAndPersist(10, { period });

      expect(financialPeriodService.findOne).not.toHaveBeenCalled();
      expect(financialPeriodService.findOrCreateCurrent).not.toHaveBeenCalled();
    });

    it('usa el resumen existente ya resuelto por el caller sin volver a consultarlo', async () => {
      const period = buildPeriod({ id: 9 });

      await service.calculateAndPersist(10, { period, existingSummary: null });

      expect(financialSummaryRepo.findOne).not.toHaveBeenCalled();
      expect(financialSummaryRepo.create).toHaveBeenCalled();
    });

    it('respeta is_final del resumen existente ya resuelto (sin volver a consultarlo)', async () => {
      const period = buildPeriod({ id: 9 });

      await expect(
        service.calculateAndPersist(10, {
          period,
          existingSummary: { id: 3, is_final: true } as never,
        }),
      ).rejects.toThrow(ConflictException);
      expect(financialSummaryRepo.findOne).not.toHaveBeenCalled();
    });
  });
});

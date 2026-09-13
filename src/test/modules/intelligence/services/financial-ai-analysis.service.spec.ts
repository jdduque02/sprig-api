import { FinancialAiAnalysisService } from '@intelligence/service/financial-ai-analysis.service';

const financialSummaryRepo = { findOne: jest.fn() };
const financialPeriodService = {
  findOne: jest.fn(),
  findOrCreateCurrent: jest.fn(),
};
const transactionRecordService = { getSummary: jest.fn() };
const calculatorService = { calculateAndPersist: jest.fn() };
const narrativeProvider = { generate: jest.fn() };

const buildPeriod = (overrides = {}) => ({
  id: 5,
  user_id: 10,
  year: 2026,
  month: 4,
  ...overrides,
});

const buildSummary = (overrides = {}) =>
  ({
    id: 1,
    user_id: 10,
    financial_period_id: 5,
    total_income: 5000000,
    total_expense: 3000000,
    total_debt: 200000,
    net_worth: 1300000,
    expense_ratio: 60,
    debt_ratio: 4,
    savings_rate: 40,
    recommended_max_expense: 4000000,
    recommended_savings: 1000000,
    is_over_spending: false,
    is_over_indebted: false,
    insights: [],
    calculated_at: new Date(),
    is_final: false,
    ...overrides,
  }) as never;

describe('FinancialAiAnalysisService', () => {
  let service: FinancialAiAnalysisService;

  beforeEach(() => {
    jest.clearAllMocks();
    financialPeriodService.findOrCreateCurrent.mockResolvedValue(buildPeriod());
    transactionRecordService.getSummary.mockResolvedValue({
      by_category: [],
    });
    narrativeProvider.generate.mockResolvedValue({
      narrative: 'Narrativa de prueba',
      recommendations: ['Ahorra más'],
    });

    service = new FinancialAiAnalysisService(
      financialSummaryRepo as never,
      financialPeriodService as never,
      transactionRecordService as never,
      calculatorService as never,
      narrativeProvider,
    );
  });

  it('reutiliza un resumen final existente sin recalcular', async () => {
    financialSummaryRepo.findOne.mockResolvedValue(
      buildSummary({ is_final: true }),
    );

    const result = await service.analyze(10);

    expect(calculatorService.calculateAndPersist).not.toHaveBeenCalled();
    expect(result.provider).toBe('rule-based');
    expect(result.narrative).toBe('Narrativa de prueba');
    expect(result.recommendations).toEqual(['Ahorra más']);
    expect(result.generated_at).toBeInstanceOf(Date);
  });

  it('recalcula si no existe un resumen para el período', async () => {
    financialSummaryRepo.findOne.mockResolvedValue(null);
    calculatorService.calculateAndPersist.mockResolvedValue(buildSummary());

    await service.analyze(10);

    // Pasa el período y el resumen (null) ya resueltos, en vez de periodId,
    // para que el calculador no repita esas mismas dos consultas.
    expect(calculatorService.calculateAndPersist).toHaveBeenCalledWith(10, {
      period: buildPeriod(),
      existingSummary: null,
    });
  });

  it('recalcula si el resumen existente no es final', async () => {
    const nonFinalSummary = buildSummary({ is_final: false });
    financialSummaryRepo.findOne.mockResolvedValue(nonFinalSummary);
    calculatorService.calculateAndPersist.mockResolvedValue(buildSummary());

    await service.analyze(10);

    expect(calculatorService.calculateAndPersist).toHaveBeenCalledWith(10, {
      period: buildPeriod(),
      existingSummary: nonFinalSummary,
    });
  });

  it('usa arreglos/valores por defecto cuando el resumen no trae insights ni calculated_at', async () => {
    financialSummaryRepo.findOne.mockResolvedValue(
      buildSummary({
        is_final: true,
        insights: undefined,
        calculated_at: undefined,
      }),
    );

    const result = await service.analyze(10);

    expect(result.insights).toEqual([]);
    expect(result.calculated_at).toBeNull();
  });

  it('usa el período indicado por periodId en vez del actual', async () => {
    financialPeriodService.findOne.mockResolvedValue(buildPeriod({ id: 9 }));
    financialSummaryRepo.findOne.mockResolvedValue(
      buildSummary({ is_final: true, financial_period_id: 9 }),
    );

    await service.analyze(10, { periodId: 9 });

    expect(financialPeriodService.findOne).toHaveBeenCalledWith(9, 10);
    expect(financialPeriodService.findOrCreateCurrent).not.toHaveBeenCalled();
  });
});

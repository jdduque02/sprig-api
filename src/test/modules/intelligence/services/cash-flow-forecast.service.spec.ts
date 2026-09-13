import { CashFlowForecastService } from '@intelligence/service/cash-flow-forecast.service';
import { FrequencyEnum, TransactionTypeEnum } from '@shared/enums';

describe('CashFlowForecastService', () => {
  let service: CashFlowForecastService;

  const mockTransactionRecordService = {
    getFixedTransactions: jest.fn(),
    getVariableAverageDaily: jest.fn(),
  };

  const mockBankAccountService = {
    findAll: jest.fn(),
  };

  const mockUserService = {
    findUser: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CashFlowForecastService(
      mockTransactionRecordService as never,
      mockBankAccountService as never,
      mockUserService as never,
    );
    mockUserService.findUser.mockResolvedValue({
      timezone: 'America/Bogota',
    });
  });

  it('debe usar solo el saldo actual proyectado cuando el usuario no tiene transacciones fijas ni variables', async () => {
    mockBankAccountService.findAll.mockResolvedValue([
      { display_balance: '1000000' },
    ]);
    mockTransactionRecordService.getFixedTransactions.mockResolvedValue([]);
    mockTransactionRecordService.getVariableAverageDaily.mockResolvedValue({
      dailyIncome: 0,
      dailyExpense: 0,
    });

    const result = await service.forecast(10);

    expect(result.current_balance).toBe(1000000);
    expect(result.buckets).toHaveLength(3);
    for (const bucket of result.buckets) {
      expect(bucket.projected_income).toBe(0);
      expect(bucket.projected_expense).toBe(0);
      expect(bucket.projected_balance).toBe(1000000);
    }
    expect(result.daily_series).toHaveLength(90);
  });

  it('debe combinar transacciones fijas y el promedio variable en la proyección', async () => {
    mockBankAccountService.findAll.mockResolvedValue([
      { display_balance: '5000000' },
    ]);
    mockTransactionRecordService.getFixedTransactions.mockResolvedValue([
      {
        id: 1,
        type: TransactionTypeEnum.INCOME,
        amount: 3000000,
        is_fixed: true,
        frequency: FrequencyEnum.MONTHLY,
        due_day: 30,
        created_at: new Date('2026-01-01'),
      },
      {
        id: 2,
        type: TransactionTypeEnum.EXPENSE,
        amount: 500000,
        is_fixed: true,
        frequency: FrequencyEnum.MONTHLY,
        due_day: 5,
        created_at: new Date('2026-01-01'),
      },
    ]);
    mockTransactionRecordService.getVariableAverageDaily.mockResolvedValue({
      dailyIncome: 10000,
      dailyExpense: 20000,
    });

    const result = await service.forecast(10);

    const bucket30 = result.buckets.find((b) => b.window_days === 30)!;
    // 30 días de gasto variable (30*20000 = 600000) + la deducción fija de
    // 500000 que cae dentro de la ventana (due_day 5 del próximo mes).
    expect(bucket30.projected_expense).toBeGreaterThan(600000);
    // 30 días de ingreso variable (30*10000 = 300000) — el ingreso fijo
    // mensual (due_day 30) puede o no caer dentro de exactamente 30 días
    // dependiendo del mes, así que solo se valida el piso variable.
    expect(bucket30.projected_income).toBeGreaterThanOrEqual(300000);
    expect(result.daily_series).toHaveLength(90);
    expect(result.historical_average_months).toBe(3);
  });

  it('el saldo proyectado acumulado debe ser monótono cuando solo hay ingresos fijos', async () => {
    mockBankAccountService.findAll.mockResolvedValue([]);
    mockTransactionRecordService.getFixedTransactions.mockResolvedValue([
      {
        id: 1,
        type: TransactionTypeEnum.INCOME,
        amount: 100000,
        is_fixed: true,
        frequency: FrequencyEnum.DAILY,
        due_day: null,
        created_at: new Date('2026-01-01'),
      },
    ]);
    mockTransactionRecordService.getVariableAverageDaily.mockResolvedValue({
      dailyIncome: 0,
      dailyExpense: 0,
    });

    const result = await service.forecast(10);

    for (let i = 1; i < result.daily_series.length; i++) {
      expect(result.daily_series[i].projected_balance).toBeGreaterThanOrEqual(
        result.daily_series[i - 1].projected_balance,
      );
    }
  });

  it('debe usar la zona horaria del usuario (America/Bogota por defecto) para calcular as_of_date', async () => {
    mockUserService.findUser.mockResolvedValue({ timezone: '' });
    mockBankAccountService.findAll.mockResolvedValue([]);
    mockTransactionRecordService.getFixedTransactions.mockResolvedValue([]);
    mockTransactionRecordService.getVariableAverageDaily.mockResolvedValue({
      dailyIncome: 0,
      dailyExpense: 0,
    });

    const result = await service.forecast(10);

    expect(result.as_of_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(
      mockTransactionRecordService.getVariableAverageDaily,
    ).toHaveBeenCalledWith(10, result.as_of_date, 3);
  });
});

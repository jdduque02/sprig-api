import { Injectable } from '@nestjs/common';
import { TransactionRecordService } from '@finance/service/transaction-record.service';
import { BankAccountService } from '@banking/service/bank-account.service';
import { UserService } from '@identity/service/user.service';
import { UserResponseDto } from '@identity/dto/user/user-response.dto';
import { todayInTimeZone } from '@shared/helpers/financial-objective.helper';
import { projectFixedOccurrences } from '@intelligence/util/cash-flow-projection.util';
import {
  CashFlowForecastBucketDto,
  CashFlowForecastPointDto,
  CashFlowForecastResponseDto,
} from '@intelligence/dto/cash-flow-forecast-response.dto';

const FORECAST_WINDOWS: Array<30 | 60 | 90> = [30, 60, 90];
const MAX_WINDOW_DAYS = 90;
// Meses históricos para promediar ingreso/gasto variable — ver
// TransactionRecordService.getVariableAverageDaily para el criterio elegido.
const HISTORICAL_AVERAGE_MONTHS = 3;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function isoDatePlusDays(todayIso: string, days: number): string {
  const d = new Date(`${todayIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

interface DailyAccumulator {
  income: number;
  expense: number;
}

@Injectable()
export class CashFlowForecastService {
  constructor(
    private readonly transactionRecordService: TransactionRecordService,
    private readonly bankAccountService: BankAccountService,
    private readonly userService: UserService,
  ) {}

  async forecast(userId: number): Promise<CashFlowForecastResponseDto> {
    const [user, accounts] = await Promise.all([
      this.userService.findUser(String(userId)) as Promise<UserResponseDto>,
      this.bankAccountService.findAll(userId),
    ]);

    const today = todayInTimeZone(user.timezone || 'America/Bogota');
    const currentBalance = accounts.reduce(
      (sum, acc) => sum + Number(acc.display_balance ?? 0),
      0,
    );

    const [fixedTransactions, variableDaily] = await Promise.all([
      this.transactionRecordService.getFixedTransactions(userId),
      this.transactionRecordService.getVariableAverageDaily(
        userId,
        today,
        HISTORICAL_AVERAGE_MONTHS,
      ),
    ]);

    const fixedOccurrences = projectFixedOccurrences(
      fixedTransactions,
      today,
      MAX_WINDOW_DAYS,
    );

    const dailyByDate = this.buildDailyAccumulators(
      fixedOccurrences,
      variableDaily,
      today,
    );

    const dailySeries = this.buildDailySeries(
      dailyByDate,
      currentBalance,
      today,
    );

    const buckets = this.buildBuckets(dailySeries, today);

    return {
      as_of_date: today,
      current_balance: round2(currentBalance),
      historical_average_months: HISTORICAL_AVERAGE_MONTHS,
      buckets,
      daily_series: dailySeries,
    };
  }

  /**
   * Combina las ocurrencias fijas proyectadas con el promedio diario
   * variable en un mapa fecha -> {income, expense} para los `MAX_WINDOW_DAYS`
   * días siguientes a `today` (today excluido: el saldo actual ya lo
   * incluye).
   */
  private buildDailyAccumulators(
    fixedOccurrences: ReturnType<typeof projectFixedOccurrences>,
    variableDaily: { dailyIncome: number; dailyExpense: number },
    today: string,
  ): Map<string, DailyAccumulator> {
    const byDate = new Map<string, DailyAccumulator>();
    for (let day = 1; day <= MAX_WINDOW_DAYS; day++) {
      const date = isoDatePlusDays(today, day);
      byDate.set(date, {
        income: variableDaily.dailyIncome,
        expense: variableDaily.dailyExpense,
      });
    }

    for (const occurrence of fixedOccurrences) {
      const bucket = byDate.get(occurrence.date);
      if (!bucket) continue; // fuera de la ventana proyectada (ej. "hoy")
      if (occurrence.signedAmount >= 0) {
        bucket.income += occurrence.signedAmount;
      } else {
        bucket.expense += -occurrence.signedAmount;
      }
    }
    return byDate;
  }

  private buildDailySeries(
    dailyByDate: Map<string, DailyAccumulator>,
    currentBalance: number,
    today: string,
  ): CashFlowForecastPointDto[] {
    const series: CashFlowForecastPointDto[] = [];
    let runningBalance = currentBalance;
    for (let day = 1; day <= MAX_WINDOW_DAYS; day++) {
      const date = isoDatePlusDays(today, day);
      const { income, expense } = dailyByDate.get(date) ?? {
        income: 0,
        expense: 0,
      };
      runningBalance += income - expense;
      series.push({
        date,
        income: round2(income),
        expense: round2(expense),
        projected_balance: round2(runningBalance),
      });
    }
    return series;
  }

  private buildBuckets(
    dailySeries: CashFlowForecastPointDto[],
    today: string,
  ): CashFlowForecastBucketDto[] {
    return FORECAST_WINDOWS.map((windowDays) => {
      const pointsInWindow = dailySeries.slice(0, windowDays);
      const lastPoint = pointsInWindow[pointsInWindow.length - 1];
      const projectedIncome = pointsInWindow.reduce(
        (sum, p) => sum + p.income,
        0,
      );
      const projectedExpense = pointsInWindow.reduce(
        (sum, p) => sum + p.expense,
        0,
      );
      return {
        window_days: windowDays,
        window_end_date: isoDatePlusDays(today, windowDays),
        projected_income: round2(projectedIncome),
        projected_expense: round2(projectedExpense),
        projected_net: round2(projectedIncome - projectedExpense),
        projected_balance: lastPoint ? lastPoint.projected_balance : round2(0),
      };
    });
  }
}

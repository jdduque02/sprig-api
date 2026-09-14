import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  forwardRef,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { FinancialObjectiveRepository } from '@finance/repositories/financial-objective.repository';
import { CreateFinancialObjectiveDto } from '@finance/dto/financial-objective/create-financial-objective.dto';
import { UpdateFinancialObjectiveDto } from '@finance/dto/financial-objective/update-financial-objective.dto';
import { CalculateQuotaDto } from '@finance/dto/financial-objective/calculate-quota.dto';
import { CalculateQuotaResponseDto } from '@finance/dto/financial-objective/calculate-quota-response.dto';
import { FinancialProfileRepository } from '@identity/repositories/financial-profile.repository';
import { UserRepository } from '@identity/repositories/app-user.repositories';
import { AuditLogService } from '@audit/service/audit-log.service';
import { TransactionRecordService } from '@finance/service/transaction-record.service';
import type { TransactionSummaryResponseDto } from '@finance/dto/transaction-record/transaction-summary-response.dto';
import type { FinancialObjectiveWithProgress } from '@finance/repositories/financial-objective.repository';
import {
  FrequencyEnum,
  AuditActionEnum,
  FinancialObjectiveTypeEnum,
  TransactionTypeEnum,
} from '@shared/enums';
import { todayInTimeZone } from '@shared/helpers/financial-objective.helper';

const DAY_MS = 24 * 60 * 60 * 1000;
// Ventana de meses completos usados para promediar el gasto mensual del
// fondo de emergencia. Mismo criterio (3 meses) que
// `HISTORICAL_AVERAGE_MONTHS` en el forecast de flujo de caja
// (`intelligence/service/cash-flow-forecast.service.ts`), documentado por
// separado aquí porque son módulos distintos y no comparten esa constante.
const EMERGENCY_FUND_EXPENSE_AVERAGE_MONTHS = 3;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export type FinancialObjectiveWithCoverage = FinancialObjectiveWithProgress & {
  months_of_expenses_covered?: number | null;
};

const DAYS_PER_FREQUENCY: Record<FrequencyEnum, number> = {
  [FrequencyEnum.DAILY]: 1,
  [FrequencyEnum.WEEKLY]: 7,
  [FrequencyEnum.BIWEEKLY]: 14,
  [FrequencyEnum.MONTHLY]: 30.44,
  [FrequencyEnum.QUARTERLY]: 91.31,
  [FrequencyEnum.YEARLY]: 365.25,
};

const PERIODS_PER_MONTH: Record<FrequencyEnum, number> = {
  [FrequencyEnum.DAILY]: 30.44,
  [FrequencyEnum.WEEKLY]: 4.33,
  [FrequencyEnum.BIWEEKLY]: 2.17,
  [FrequencyEnum.MONTHLY]: 1,
  [FrequencyEnum.QUARTERLY]: 1 / 3,
  [FrequencyEnum.YEARLY]: 1 / 12,
};

const PERIODS_PER_YEAR: Record<FrequencyEnum, number> = {
  [FrequencyEnum.DAILY]: 365,
  [FrequencyEnum.WEEKLY]: 52,
  [FrequencyEnum.BIWEEKLY]: 26,
  [FrequencyEnum.MONTHLY]: 12,
  [FrequencyEnum.QUARTERLY]: 4,
  [FrequencyEnum.YEARLY]: 1,
};

const FREQUENCY_LABEL: Record<FrequencyEnum, string> = {
  [FrequencyEnum.DAILY]: 'día',
  [FrequencyEnum.WEEKLY]: 'semana',
  [FrequencyEnum.BIWEEKLY]: 'quincena',
  [FrequencyEnum.MONTHLY]: 'mes',
  [FrequencyEnum.QUARTERLY]: 'trimestre',
  [FrequencyEnum.YEARLY]: 'año',
};

@Injectable()
export class FinancialObjectiveService {
  private readonly logger = new Logger(FinancialObjectiveService.name);

  constructor(
    private readonly financialObjectiveRepository: FinancialObjectiveRepository,
    @Inject(forwardRef(() => FinancialProfileRepository))
    private readonly financialProfileRepository: FinancialProfileRepository,
    private readonly userRepository: UserRepository,
    private readonly auditLogService: AuditLogService,
    private readonly transactionRecordService: TransactionRecordService,
    @Inject(I18nService) private readonly i18n: I18nService,
  ) {}

  async create(userId: number, dto: CreateFinancialObjectiveDto) {
    const created = await this.financialObjectiveRepository.create(userId, dto);
    return this.attachEmergencyFundCoverage(userId, created);
  }

  async findAll(userId: number) {
    const objectives = await this.financialObjectiveRepository.findAll(userId);
    return Promise.all(
      objectives.map((o) => this.attachEmergencyFundCoverage(userId, o)),
    );
  }

  async findOne(id: number, userId: number) {
    const objective = await this.financialObjectiveRepository.findById(
      id,
      userId,
    );
    return this.attachEmergencyFundCoverage(userId, objective);
  }

  async update(id: number, userId: number, dto: UpdateFinancialObjectiveDto) {
    const updated = await this.financialObjectiveRepository.update(
      id,
      userId,
      dto,
    );
    return this.attachEmergencyFundCoverage(userId, updated);
  }

  /**
   * Adjunta `months_of_expenses_covered` solo a objetivos de tipo
   * `emergency_fund`. Indicador = current_balance / gasto mensual promedio
   * del usuario (últimos `EMERGENCY_FUND_EXPENSE_AVERAGE_MONTHS` meses
   * calendario completos, sin incluir el mes en curso). Reutiliza
   * `TransactionRecordService.getSummary` (ya agrega ingresos/gastos por
   * rango de `transaction_date`) en vez de duplicar lógica de promedios —
   * a diferencia de `getVariableAverageDaily` (usado por el forecast de
   * `intelligence`), `getSummary` incluye TODOS los gastos (fijos y
   * variables), que es lo correcto para dimensionar un fondo de emergencia.
   */
  private async attachEmergencyFundCoverage(
    userId: number,
    objective: FinancialObjectiveWithProgress,
  ): Promise<FinancialObjectiveWithCoverage> {
    if (objective.type !== FinancialObjectiveTypeEnum.EMERGENCY_FUND) {
      return objective;
    }
    const months_of_expenses_covered =
      await this.computeMonthsOfExpensesCovered(
        userId,
        Number(objective.current_balance ?? 0),
      );
    return { ...objective, months_of_expenses_covered };
  }

  private async computeMonthsOfExpensesCovered(
    userId: number,
    currentBalance: number,
  ): Promise<number | null> {
    let timezone = 'America/Bogota';
    try {
      const user = await this.userRepository.findById(String(userId));
      timezone = user.timezone || 'America/Bogota';
    } catch {
      this.logger.debug(
        `Usuario ${userId} no encontrado; se usa zona horaria por defecto ` +
          'para el cálculo de cobertura del fondo de emergencia.',
      );
    }

    const today = todayInTimeZone(timezone);
    const [year, month] = today.split('-').map(Number);
    // Últimos N meses calendario COMPLETOS (excluye el mes en curso, que
    // está parcial y sesgaría el promedio hacia abajo).
    const currentMonthStart = new Date(year, month - 1, 1);
    const dateFrom = new Date(
      year,
      month - 1 - EMERGENCY_FUND_EXPENSE_AVERAGE_MONTHS,
      1,
    );
    const dateTo = new Date(currentMonthStart.getTime() - DAY_MS);

    const summary = (await this.transactionRecordService.getSummary(userId, {
      date_from: formatIsoDate(dateFrom),
      date_to: formatIsoDate(dateTo),
      type: TransactionTypeEnum.EXPENSE,
    })) as TransactionSummaryResponseDto;

    const totalExpense = Number(summary.totals?.expenses ?? 0);
    if (totalExpense <= 0) return null;

    const averageMonthlyExpense =
      totalExpense / EMERGENCY_FUND_EXPENSE_AVERAGE_MONTHS;
    if (averageMonthlyExpense <= 0) return null;

    return round2(currentBalance / averageMonthlyExpense);
  }

  async remove(id: number, userId: number) {
    return this.financialObjectiveRepository.softDelete(id, userId);
  }

  async calculateQuota(
    userId: number,
    dto: CalculateQuotaDto,
  ): Promise<CalculateQuotaResponseDto> {
    const warnings: string[] = [];
    const recommendations: string[] = [];
    let monthlyIncome: number | null = null;
    let savingsRatio = 20;
    let hasFinancialProfile = false;

    // 1. Obtener perfil financiero del usuario
    try {
      const profile = await this.financialProfileRepository.findByUserId(
        String(userId),
      );
      hasFinancialProfile = true;
      monthlyIncome = profile.monthly_income as unknown as number;
      savingsRatio = profile.savings_ratio ?? 20;
    } catch {
      this.logger.debug(
        `Usuario ${userId} no tiene perfil financiero registrado.`,
      );
    }

    // 2. Validar fin de período (hoy en la zona horaria del usuario)
    let timezone = 'America/Bogota';
    try {
      const user = await this.userRepository.findById(String(userId));
      timezone = user.timezone || 'America/Bogota';
    } catch {
      this.logger.debug(
        `Usuario ${userId} no encontrado; se usa zona horaria por defecto.`,
      );
    }
    const today = todayInTimeZone(timezone);
    const startDate = dto.start_date ?? today;

    if (!dto.end_date || dto.target_amount == null) {
      const noPlanResponse: CalculateQuotaResponseDto = {
        target_amount: dto.target_amount ?? null,
        current_balance: dto.current_balance ?? 0,
        amount_to_save: dto.target_amount
          ? Math.max(0, dto.target_amount - (dto.current_balance ?? 0))
          : null,
        start_date: startDate,
        end_date: null,
        frequency: dto.frequency,
        total_periods: 0,
        days_in_period: 0,
        quota_amount: 0,
        monthly_income: monthlyIncome,
        savings_ratio: savingsRatio,
        max_allowed_per_period: null,
        is_within_budget: null,
        bank: null,
        current_profitability: null,
        projected_final_balance: null,
        has_financial_profile: hasFinancialProfile,
        warnings: [],
        recommendations: [
          this.i18n.t('finance.SET_END_DATE_RECOMMENDATION'),
          this.i18n.t('finance.REUSE_ROUTE_HINT'),
        ],
      };

      await this.logCalculation(userId, noPlanResponse);
      return noPlanResponse;
    }

    // 3. Validar montos
    const amountToSave = Math.max(
      0,
      dto.target_amount - (dto.current_balance ?? 0),
    );

    if (amountToSave === 0) {
      warnings.push(
        'Ya alcanzaste o superaste tu objetivo de ahorro: tu saldo actual ' +
          'iguala o supera el monto objetivo. La cuota sugerida es $0, ' +
          'por lo que no necesitas ahorrar más.',
      );
    }

    // 4. Calcular períodos (fechas en UTC para evitar desfases de zona horaria)
    const start = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${dto.end_date}T00:00:00Z`);

    if (start.getTime() >= end.getTime()) {
      throw new BadRequestException(this.i18n.t('finance.INVALID_DATE_RANGE'));
    }

    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Mensual: períodos = meses calendario (parte los meses, no 30.44 días).
    let totalPeriods: number;
    if (dto.frequency === FrequencyEnum.MONTHLY) {
      const monthDiff =
        (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
        (end.getUTCMonth() - start.getUTCMonth());
      totalPeriods =
        monthDiff + (end.getUTCDate() >= start.getUTCDate() ? 1 : 0);
    } else {
      const daysPerPeriod = DAYS_PER_FREQUENCY[dto.frequency];
      totalPeriods = Math.ceil(diffDays / daysPerPeriod);
    }
    totalPeriods = Math.max(1, totalPeriods);
    const daysInPeriod = Math.ceil(diffDays / totalPeriods);

    // 5. Calcular cuota
    const quotaAmount = amountToSave / totalPeriods;

    // 6. Calcular rentabilidad proyectada (interés compuesto)
    let annualRate = dto.interest_rate ?? 0;
    let bankName: string | null = null;

    if (dto.account_id) {
      const accountInfo =
        await this.financialObjectiveRepository.resolveAccountForQuota(
          userId,
          dto.account_id,
        );
      if (accountInfo) {
        bankName = accountInfo.bank;
        if (annualRate <= 0 && accountInfo.annual_interest_rate != null) {
          annualRate = accountInfo.annual_interest_rate;
        }
      }
    }

    const currentProfitability = annualRate > 0 ? annualRate : null;
    let projectedFinalBalance: number | null = null;

    if (annualRate > 0 && totalPeriods > 0) {
      const periodsPerYear = PERIODS_PER_YEAR[dto.frequency];
      const periodicRate = annualRate / 100 / periodsPerYear;
      const growthFactor = Math.pow(1 + periodicRate, totalPeriods);
      // FV = P(1+i)^n + Q * (((1+i)^n - 1) / i)
      // P: saldo actual, Q: cuota periódica, i: tasa periódica, n: total de períodos
      projectedFinalBalance =
        (dto.current_balance ?? 0) * growthFactor +
        quotaAmount * ((growthFactor - 1) / periodicRate);
      projectedFinalBalance = Math.round(projectedFinalBalance * 100) / 100;
    }

    // 7. Validar contra regla 50-30-20
    let maxAllowedPerPeriod: number | null = null;
    let isWithinBudget: boolean | null = null;

    if (monthlyIncome !== null && monthlyIncome > 0) {
      const periodsPerMonth = PERIODS_PER_MONTH[dto.frequency];
      maxAllowedPerPeriod =
        (monthlyIncome * (savingsRatio / 100)) / periodsPerMonth;
      isWithinBudget = quotaAmount <= maxAllowedPerPeriod;

      if (!isWithinBudget) {
        warnings.push(
          `Tu cuota de $${quotaAmount.toLocaleString('es-CO', { maximumFractionDigits: 0 })} ` +
            `excede el ${savingsRatio}% recomendado de tu ingreso mensual ` +
            `($${monthlyIncome.toLocaleString('es-CO', { maximumFractionDigits: 0 })}). ` +
            `El máximo recomendado por ${FREQUENCY_LABEL[dto.frequency]} ` +
            `es $${maxAllowedPerPeriod.toLocaleString('es-CO', { maximumFractionDigits: 0 })}.`,
        );
        recommendations.push(
          this.i18n.t('finance.REDUCE_OR_EXTEND_RECOMMENDATION'),
        );
      }
    } else {
      recommendations.push(
        this.i18n.t('finance.REGISTER_INCOME_RECOMMENDATION'),
      );
    }

    // 8. Sin perfil financiero
    if (!hasFinancialProfile) {
      recommendations.push(this.i18n.t('finance.LOAD_PROFILE_RECOMMENDATION'));
    }

    // 9. Recomendación de proyección con interés compuesto
    if (annualRate > 0 && projectedFinalBalance != null) {
      recommendations.push(
        `Con una tasa anual del ${annualRate}%, tu saldo proyectado al final del plazo sería ` +
          `$${projectedFinalBalance.toLocaleString('es-CO', { maximumFractionDigits: 0 })}.`,
      );
    }

    const response: CalculateQuotaResponseDto = {
      target_amount: dto.target_amount,
      current_balance: dto.current_balance ?? 0,
      amount_to_save: amountToSave,
      start_date: startDate,
      end_date: dto.end_date,
      frequency: dto.frequency,
      total_periods: totalPeriods,
      days_in_period: daysInPeriod,
      quota_amount: Math.round(quotaAmount * 100) / 100,
      monthly_income: monthlyIncome,
      savings_ratio: savingsRatio,
      max_allowed_per_period: maxAllowedPerPeriod
        ? Math.round(maxAllowedPerPeriod * 100) / 100
        : null,
      is_within_budget: isWithinBudget,
      bank: bankName,
      current_profitability: currentProfitability,
      projected_final_balance: projectedFinalBalance,
      has_financial_profile: hasFinancialProfile,
      warnings,
      recommendations,
    };

    await this.logCalculation(userId, response);

    return response;
  }

  private async logCalculation(
    userId: number,
    response: CalculateQuotaResponseDto,
  ): Promise<void> {
    try {
      await this.auditLogService.write({
        schema_name: 'finance',
        table_name: 'financial_objective',
        record_id: 0,
        action: AuditActionEnum.INSERT,
        changed_by: userId,
        new_data: {
          type: 'quota_calculation',
          target_amount: response.target_amount,
          current_balance: response.current_balance,
          amount_to_save: response.amount_to_save,
          frequency: response.frequency,
          total_periods: response.total_periods,
          quota_amount: response.quota_amount,
          monthly_income_visible: response.monthly_income !== null,
          savings_ratio: response.savings_ratio,
          is_within_budget: response.is_within_budget,
          has_financial_profile: response.has_financial_profile,
          start_date: response.start_date,
          end_date: response.end_date,
        },
      });
    } catch (error) {
      this.logger.warn(
        `No se pudo registrar audit log para cálculo de cuota del usuario ${userId}: ${(error as Error).message}`,
      );
    }
  }
}

import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { IsNull, Repository } from 'typeorm';
import {
  FinancialInsight,
  FinancialSummary,
} from '@intelligence/entities/financial-summary.entity';
import { resolvePeriodDateRange } from '@intelligence/util/period-range.util';
import { TransactionRecordService } from '@finance/service/transaction-record.service';
import { FinancialObjectiveService } from '@finance/service/financial-objective.service';
import { FinancialObjectiveWithProgress } from '@finance/repositories/financial-objective.repository';
import { FinancialPeriodService } from '@finance/service/financial-period.service';
import { FinancialPeriod } from '@finance/entities/financial-period.entity';
import { BankAccountService } from '@banking/service/bank-account.service';
import { FinancialAssetService } from '@banking/service/financial-asset.service';
import { FinancialLiabilityService } from '@banking/service/financial-liability.service';
import { FinancialProfileService } from '@identity/service/financial-profile.service';
import { FinancialProfile } from '@identity/entities/financial-profile.entity';
import { TransactionSummaryResponseDto } from '@finance/dto/transaction-record/transaction-summary-response.dto';

interface FinancialRatios {
  expense_ratio: number | null;
  savings_rate: number | null;
  debt_ratio: number | null;
  recommended_max_expense: number;
  recommended_savings: number;
  is_over_spending: boolean;
  is_over_indebted: boolean;
}

interface NetWorthInfo {
  netWorth: number;
  totalDebt: number;
}

// Umbral de "objetivo atrasado": meta activa cuyo plazo se acorta y cuyo
// avance no acompaña ese plazo. No especificado por el usuario; valor
// razonable documentado aquí para ajustarlo si hace falta.
const OBJECTIVE_AT_RISK_DAYS_REMAINING = 30;
const OBJECTIVE_AT_RISK_PROGRESS_PERCENT = 80;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

@Injectable()
export class FinancialSummaryCalculatorService {
  constructor(
    @InjectRepository(FinancialSummary)
    private readonly financialSummaryRepo: Repository<FinancialSummary>,
    private readonly transactionRecordService: TransactionRecordService,
    private readonly financialObjectiveService: FinancialObjectiveService,
    private readonly financialPeriodService: FinancialPeriodService,
    private readonly bankAccountService: BankAccountService,
    private readonly financialAssetService: FinancialAssetService,
    private readonly financialLiabilityService: FinancialLiabilityService,
    private readonly financialProfileService: FinancialProfileService,
    @Inject(I18nService) private readonly i18n: I18nService,
  ) {}

  async calculateAndPersist(
    userId: number,
    options?: {
      periodId?: number;
      // Si el caller ya resolvió el período y/o el resumen existente (p. ej.
      // FinancialAiAnalysisService.analyze), se reciben aquí para no repetir
      // esas mismas consultas dentro de este método.
      period?: FinancialPeriod;
      existingSummary?: FinancialSummary | null;
    },
  ): Promise<FinancialSummary> {
    const period =
      options?.period ??
      (options?.periodId
        ? await this.financialPeriodService.findOne(options.periodId, userId)
        : await this.financialPeriodService.findOrCreateCurrent(userId));

    const existing = Object.prototype.hasOwnProperty.call(
      options ?? {},
      'existingSummary',
    )
      ? (options!.existingSummary ?? null)
      : await this.financialSummaryRepo.findOne({
          where: {
            user_id: userId,
            financial_period_id: period.id,
            deleted_at: IsNull(),
          },
        });
    if (existing?.is_final) {
      throw new ConflictException(
        this.i18n.t('intelligence.FINANCIAL_SUMMARY_ALREADY_FINAL', {
          args: { periodId: period.id },
        }),
      );
    }

    const { date_from, date_to } = resolvePeriodDateRange(
      period.year,
      period.month,
    );
    // Independiente entre sí (solo dependen de userId/rango de fechas, no
    // unas de otras) — se resuelven en paralelo en vez de en serie.
    const [profile, txSummary, netWorthInfo, objectives] = await Promise.all([
      this.resolveProfile(userId),
      this.transactionRecordService.getSummary(userId, {
        date_from,
        date_to,
        group_by: 'month',
      }) as Promise<TransactionSummaryResponseDto>,
      this.resolveNetWorth(userId),
      this.financialObjectiveService.findAll(userId),
    ]);

    const ratios = this.computeRatios(
      txSummary.totals,
      netWorthInfo.totalDebt,
      profile,
    );
    const insights = this.buildInsights(
      ratios,
      txSummary.totals,
      objectives,
      profile,
    );

    const data: Partial<FinancialSummary> = {
      user_id: userId,
      financial_period_id: period.id,
      profile_id: Number(profile.id),
      total_income: txSummary.totals.income,
      total_expense: txSummary.totals.expenses,
      total_debt: netWorthInfo.totalDebt,
      net_worth: netWorthInfo.netWorth,
      ...ratios,
      insights,
      calculated_at: new Date(),
    };

    return existing
      ? this.financialSummaryRepo.save({ ...existing, ...data })
      : this.financialSummaryRepo.save(this.financialSummaryRepo.create(data));
  }

  private async resolveProfile(userId: number): Promise<FinancialProfile> {
    try {
      return await this.financialProfileService.findByUserId(String(userId));
    } catch (error) {
      // Solo el caso "sin perfil" se traduce al mensaje de dominio; un error
      // de infraestructura (DB caída, etc.) no debe reportarse como si al
      // usuario le faltara crear su perfil.
      if (!(error instanceof NotFoundException)) throw error;
      throw new NotFoundException(
        this.i18n.t('intelligence.FINANCIAL_PROFILE_REQUIRED', {
          args: { userId },
        }),
      );
    }
  }

  private async resolveNetWorth(userId: number): Promise<NetWorthInfo> {
    const [accounts, assets, liabilities] = await Promise.all([
      this.bankAccountService.findAll(userId),
      this.financialAssetService.findAll(userId),
      this.financialLiabilityService.findAll(userId),
    ]);
    const bankTotal = accounts.reduce(
      (sum, a) => sum + Number(a.display_balance ?? 0),
      0,
    );
    const assetsTotal = assets.reduce(
      (sum, a) => sum + Number(a.current_value ?? 0),
      0,
    );
    const totalDebt = liabilities.reduce(
      (sum, l) => sum + Number(l.current_balance ?? 0),
      0,
    );
    return { netWorth: bankTotal + assetsTotal - totalDebt, totalDebt };
  }

  private computeRatios(
    totals: { income: number; expenses: number },
    totalDebt: number,
    profile: FinancialProfile,
  ): FinancialRatios {
    const income = Number(totals.income ?? 0);
    const expense = Number(totals.expenses ?? 0);
    const expense_ratio = income > 0 ? round2((expense / income) * 100) : null;
    const savings_rate =
      income > 0 ? round2(((income - expense) / income) * 100) : null;
    const debt_ratio = income > 0 ? round2((totalDebt / income) * 100) : null;
    const recommended_max_expense = round2(
      (income * (Number(profile.needs_ratio) + Number(profile.wants_ratio))) /
        100,
    );
    const recommended_savings = round2(
      (income * Number(profile.savings_ratio)) / 100,
    );
    return {
      expense_ratio,
      savings_rate,
      debt_ratio,
      recommended_max_expense,
      recommended_savings,
      is_over_spending: expense > recommended_max_expense,
      is_over_indebted:
        debt_ratio !== null && debt_ratio > Number(profile.max_debt_ratio),
    };
  }

  private buildInsights(
    ratios: FinancialRatios,
    totals: { income: number; expenses: number },
    objectives: FinancialObjectiveWithProgress[],
    profile: FinancialProfile,
  ): FinancialInsight[] {
    const insights: FinancialInsight[] = [];
    this.pushOverspendingInsight(insights, ratios, totals);
    this.pushIndebtednessInsight(insights, ratios);
    this.pushSavingsInsight(insights, ratios, profile);
    this.pushObjectiveInsights(insights, objectives);
    return insights;
  }

  private pushOverspendingInsight(
    insights: FinancialInsight[],
    ratios: FinancialRatios,
    totals: { income: number; expenses: number },
  ): void {
    if (!ratios.is_over_spending) return;
    insights.push({
      type: 'overspending',
      severity: 'high',
      message:
        'Tus gastos del período superan el máximo recomendado según tu perfil financiero ' +
        `(gastaste ${Number(totals.expenses ?? 0)} de un máximo recomendado de ${ratios.recommended_max_expense}).`,
      suggested_action:
        'Revisa tus categorías de mayor gasto y ajusta lo que no sea esencial este período.',
    });
  }

  private pushIndebtednessInsight(
    insights: FinancialInsight[],
    ratios: FinancialRatios,
  ): void {
    if (!ratios.is_over_indebted) return;
    insights.push({
      type: 'over_indebted',
      severity: 'critical',
      message: `Tu relación deuda/ingreso (${ratios.debt_ratio}%) supera el umbral máximo definido en tu perfil financiero.`,
      suggested_action:
        'Prioriza el pago de tus pasivos con mayor tasa de interés antes de asumir nueva deuda.',
    });
  }

  private pushSavingsInsight(
    insights: FinancialInsight[],
    ratios: FinancialRatios,
    profile: FinancialProfile,
  ): void {
    if (ratios.savings_rate === null) return;
    if (ratios.savings_rate >= Number(profile.savings_ratio)) return;
    insights.push({
      type: 'low_savings',
      severity: 'medium',
      message: `Tu tasa de ahorro del período (${ratios.savings_rate}%) está por debajo del ${profile.savings_ratio}% que define tu perfil financiero.`,
      suggested_action:
        'Considera automatizar una transferencia a ahorro al inicio del período, antes de gastar.',
    });
  }

  private pushObjectiveInsights(
    insights: FinancialInsight[],
    objectives: FinancialObjectiveWithProgress[],
  ): void {
    const atRisk = objectives.filter(
      (o) =>
        !o.is_completed &&
        o.end_date != null &&
        o.days_remaining !== null &&
        o.days_remaining <= OBJECTIVE_AT_RISK_DAYS_REMAINING &&
        o.progress_percent !== null &&
        o.progress_percent < OBJECTIVE_AT_RISK_PROGRESS_PERCENT,
    );
    for (const objective of atRisk) {
      insights.push({
        type: 'objective_at_risk',
        severity: 'medium',
        message: `La meta "${objective.name}" lleva ${objective.progress_percent}% de avance y le quedan ${objective.days_remaining} días — está en riesgo de no cumplirse a tiempo.`,
        category_id: objective.category_id ?? undefined,
        suggested_action:
          'Aumenta el aporte periódico a esta meta o ajusta su fecha límite si ya no es realista.',
      });
    }
  }
}

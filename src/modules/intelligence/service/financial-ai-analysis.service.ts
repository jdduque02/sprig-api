import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { FinancialSummary } from '@intelligence/entities/financial-summary.entity';
import { resolvePeriodDateRange } from '@intelligence/util/period-range.util';
import { mapFinancialSummary } from '@intelligence/util/financial-summary-mapper.util';
import { FinancialSummaryCalculatorService } from '@intelligence/service/financial-summary-calculator.service';
import { FinancialAiAnalysisResponseDto } from '@intelligence/dto/financial-ai-analysis-response.dto';
import { FinancialPeriodService } from '@finance/service/financial-period.service';
import { TransactionRecordService } from '@finance/service/transaction-record.service';
import {
  TransactionCategorySummaryDto,
  TransactionSummaryResponseDto,
} from '@finance/dto/transaction-record/transaction-summary-response.dto';

export const FINANCIAL_NARRATIVE_PROVIDER = Symbol(
  'FINANCIAL_NARRATIVE_PROVIDER',
);

export interface FinancialNarrativeContext {
  summary: FinancialSummary;
  categoryBreakdown: TransactionCategorySummaryDto[];
}

/**
 * Punto de extensión para el generador de narrativa del análisis financiero.
 * Hoy solo existe `RuleBasedFinancialNarrativeProvider` (determinístico, sin
 * SDK ni red). Cuando haya una API key de un proveedor de IA real, se agrega
 * una nueva clase que implemente esta interfaz y se registra bajo el mismo
 * token `FINANCIAL_NARRATIVE_PROVIDER` en intelligence.module.ts — sin tocar
 * el controller, el DTO ni el calculador.
 */
export interface FinancialNarrativeProvider {
  generate(
    context: FinancialNarrativeContext,
  ): Promise<{ narrative: string; recommendations: string[] }>;
}

@Injectable()
export class FinancialAiAnalysisService {
  constructor(
    @InjectRepository(FinancialSummary)
    private readonly financialSummaryRepo: Repository<FinancialSummary>,
    private readonly financialPeriodService: FinancialPeriodService,
    private readonly transactionRecordService: TransactionRecordService,
    private readonly calculatorService: FinancialSummaryCalculatorService,
    @Inject(FINANCIAL_NARRATIVE_PROVIDER)
    private readonly narrativeProvider: FinancialNarrativeProvider,
  ) {}

  async analyze(
    userId: number,
    options?: { periodId?: number },
  ): Promise<FinancialAiAnalysisResponseDto> {
    const period = options?.periodId
      ? await this.financialPeriodService.findOne(options.periodId, userId)
      : await this.financialPeriodService.findOrCreateCurrent(userId);

    let summary = await this.financialSummaryRepo.findOne({
      where: {
        user_id: userId,
        financial_period_id: period.id,
        deleted_at: IsNull(),
      },
    });
    if (!summary || !summary.is_final) {
      // Recalcula (upsert idempotente por user_id+financial_period_id) en
      // vez de solo leer: el análisis es "on-demand" por diseño y el período
      // sigue abierto (is_final=false), así que no hay riesgo de duplicar ni
      // de sobrescribir un resumen cerrado. Intencional pese a ser un GET.
      // Se pasan `period`/`existingSummary` ya resueltos para que el
      // calculador no repita las mismas dos consultas que acabamos de hacer.
      summary = await this.calculatorService.calculateAndPersist(userId, {
        period,
        existingSummary: summary,
      });
    }

    const { date_from, date_to } = resolvePeriodDateRange(
      period.year,
      period.month,
    );
    const txSummary = (await this.transactionRecordService.getSummary(userId, {
      date_from,
      date_to,
      group_by: 'month',
    })) as TransactionSummaryResponseDto;

    const { narrative, recommendations } =
      await this.narrativeProvider.generate({
        summary,
        categoryBreakdown: txSummary.by_category,
      });

    return this.toResponseDto(summary, narrative, recommendations);
  }

  private toResponseDto(
    summary: FinancialSummary,
    narrative: string,
    recommendations: string[],
  ): FinancialAiAnalysisResponseDto {
    return {
      ...mapFinancialSummary(summary),
      narrative,
      recommendations,
      provider: 'rule-based',
      generated_at: new Date(),
    };
  }
}

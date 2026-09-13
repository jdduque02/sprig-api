import { Injectable } from '@nestjs/common';
import { FinancialSummary } from '@intelligence/entities/financial-summary.entity';
import { TransactionCategorySummaryDto } from '@finance/dto/transaction-record/transaction-summary-response.dto';
import {
  FinancialNarrativeContext,
  FinancialNarrativeProvider,
} from '@intelligence/service/financial-ai-analysis.service';

const MAX_RECOMMENDATIONS = 5;

/**
 * Generador de narrativa por defecto: compone el análisis financiero a
 * partir de las cifras ya calculadas (FinancialSummary + insights), sin
 * SDK ni llamadas de red. `generate` es `async` sin `await` real para
 * cumplir la interfaz `Promise`-based que deja listo el punto de extensión
 * de un proveedor LLM real a futuro.
 */
@Injectable()
export class RuleBasedFinancialNarrativeProvider implements FinancialNarrativeProvider {
  // eslint-disable-next-line @typescript-eslint/require-await
  async generate(
    context: FinancialNarrativeContext,
  ): Promise<{ narrative: string; recommendations: string[] }> {
    const { summary, categoryBreakdown } = context;
    const paragraphs = [
      this.buildOverviewParagraph(summary),
      this.buildSavingsParagraph(summary),
      this.buildAlertParagraph(summary),
      this.buildCategoryParagraph(categoryBreakdown),
    ].filter((p): p is string => !!p);

    return {
      narrative: paragraphs.join('\n\n'),
      recommendations: this.buildRecommendations(summary),
    };
  }

  private buildOverviewParagraph(summary: FinancialSummary): string {
    return (
      `Durante este período tuviste ingresos por ${summary.total_income} y gastos por ` +
      `${summary.total_expense}, con un patrimonio neto actual de ${summary.net_worth} ` +
      `(deudas totales: ${summary.total_debt}).`
    );
  }

  private buildSavingsParagraph(summary: FinancialSummary): string {
    if (summary.savings_rate === null) {
      return 'No se pudo calcular tu tasa de ahorro porque no se registraron ingresos en el período.';
    }
    const cumple =
      summary.recommended_savings != null &&
      summary.total_income - summary.total_expense >=
        summary.recommended_savings;
    return cumple
      ? `Tu tasa de ahorro fue del ${summary.savings_rate}%, cumpliendo la meta recomendada para tu perfil financiero.`
      : `Tu tasa de ahorro fue del ${summary.savings_rate}%, por debajo de la meta recomendada de tu perfil financiero.`;
  }

  private buildAlertParagraph(summary: FinancialSummary): string | null {
    if (!summary.is_over_spending && !summary.is_over_indebted) return null;
    const alerts: string[] = [];
    if (summary.is_over_spending) {
      alerts.push('tus gastos superaron el máximo recomendado para tu perfil');
    }
    if (summary.is_over_indebted) {
      alerts.push('tu nivel de endeudamiento supera el umbral de tu perfil');
    }
    return `Atención: ${alerts.join(' y ')}. Revisa los insights de este resumen para más detalle.`;
  }

  private buildCategoryParagraph(
    categoryBreakdown: TransactionCategorySummaryDto[],
  ): string {
    if (!categoryBreakdown || categoryBreakdown.length === 0) {
      return 'No se registraron transacciones categorizadas en este período.';
    }
    const top = [...categoryBreakdown].sort(
      (a, b) => b.expenses - a.expenses,
    )[0];
    return (
      `Tuviste movimientos en ${categoryBreakdown.length} categoría(s). ` +
      `La categoría con mayor gasto fue la #${top.category_id}, con ${top.expenses} en ${top.count} transacción(es).`
    );
  }

  private buildRecommendations(summary: FinancialSummary): string[] {
    const fromInsights = (summary.insights ?? [])
      .map((i) => i.suggested_action)
      .filter((action): action is string => !!action);
    const unique = Array.from(new Set(fromInsights)).slice(
      0,
      MAX_RECOMMENDATIONS,
    );
    if (unique.length > 0) return unique;
    return [
      'Registra todas tus transacciones para obtener un análisis más preciso.',
      'Revisa periódicamente tu perfil financiero (needs/wants/savings) para que las recomendaciones se ajusten a tu realidad.',
    ];
  }
}

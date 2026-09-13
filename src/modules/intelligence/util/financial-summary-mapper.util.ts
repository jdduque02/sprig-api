import { FinancialSummary } from '@intelligence/entities/financial-summary.entity';
import { FinancialSummaryResponseDto } from '@intelligence/dto/financial-summary-response.dto';

/**
 * Mapeo entidad -> DTO de `financial_summary`, compartido por todo lo que
 * expone un resumen financiero (lectura directa y análisis con IA) para que
 * ambos no puedan divergir.
 */
export function mapFinancialSummary(
  entity: FinancialSummary,
): FinancialSummaryResponseDto {
  return {
    id: entity.id,
    user_id: entity.user_id,
    financial_period_id: entity.financial_period_id,
    total_income: entity.total_income,
    total_expense: entity.total_expense,
    total_debt: entity.total_debt,
    net_worth: entity.net_worth,
    expense_ratio: entity.expense_ratio,
    debt_ratio: entity.debt_ratio,
    savings_rate: entity.savings_rate,
    recommended_max_expense: entity.recommended_max_expense,
    recommended_savings: entity.recommended_savings,
    is_over_spending: entity.is_over_spending,
    is_over_indebted: entity.is_over_indebted,
    insights: entity.insights ?? [],
    calculated_at: entity.calculated_at ?? null,
    is_final: entity.is_final,
  };
}

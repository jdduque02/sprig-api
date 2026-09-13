-- ============================================================
-- 20260907-create-financial-summary-table.sql
--   * intelligence.financial_summary -> primer productor real del
--     resumen financiero por período (net worth, ratios, insights).
--     Antes de esta migración la tabla no existía en BD: el
--     endpoint GET /financial-summary no tenía productor.
--     Ver FinancialSummaryCalculatorService.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS intelligence;

CREATE TABLE IF NOT EXISTS intelligence.financial_summary (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL,
  financial_period_id BIGINT NOT NULL,
  profile_id BIGINT NOT NULL,
  total_income NUMERIC(15, 2) NOT NULL DEFAULT 0,
  total_expense NUMERIC(15, 2) NOT NULL DEFAULT 0,
  total_debt NUMERIC(15, 2) NOT NULL DEFAULT 0,
  net_worth NUMERIC(15, 2) NOT NULL DEFAULT 0,
  expense_ratio NUMERIC(5, 2),
  debt_ratio NUMERIC(5, 2),
  savings_rate NUMERIC(5, 2),
  recommended_max_expense NUMERIC(15, 2),
  recommended_savings NUMERIC(15, 2),
  is_over_spending BOOLEAN NOT NULL DEFAULT FALSE,
  is_over_indebted BOOLEAN NOT NULL DEFAULT FALSE,
  insights JSONB DEFAULT '[]',
  calculated_at TIMESTAMP,
  is_final BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_financial_summary_user_period
  ON intelligence.financial_summary (user_id, financial_period_id);

CREATE INDEX IF NOT EXISTS idx_financial_summary_user
  ON intelligence.financial_summary (user_id);

CREATE INDEX IF NOT EXISTS idx_financial_summary_period
  ON intelligence.financial_summary (financial_period_id);

CREATE INDEX IF NOT EXISTS idx_financial_summary_final
  ON intelligence.financial_summary (is_final);

COMMENT ON TABLE intelligence.financial_summary
  IS 'Resumen financiero calculado por período: net worth, ratios (comparados contra identity.financial_profile) e insights. CRÍTICO: registros con is_final = TRUE nunca deben recalcularse (validado en FinancialSummaryCalculatorService).';

COMMENT ON COLUMN intelligence.financial_summary.profile_id
  IS 'Referencia lógica a identity.financial_profile.id usado para calcular los ratios recomendados. Sin FK física (esquemas separados, convención del repo).';

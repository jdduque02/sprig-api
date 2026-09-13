-- ============================================================
-- SCRIPT SQL: Vínculo meta->cuenta bancaria + tasa anual de cuentas
-- Fecha: 2026-08-04
-- Base de datos: PostgreSQL 16
-- ============================================================

-- 1. Tasa de interés anual de las cuentas bancarias (para proyección compuesta)
ALTER TABLE banking.bank_account
  ADD COLUMN IF NOT EXISTS annual_interest_rate NUMERIC(5,2);

COMMENT ON COLUMN banking.bank_account.annual_interest_rate IS 'Tasa de interés anual de la cuenta en porcentaje (ej: 4.50 = 4.5% anual).';

-- 2. Vínculo opcional de la meta a una cuenta bancaria (patrimonio donde se ahorra)
ALTER TABLE finance.financial_objective
  ADD COLUMN IF NOT EXISTS account_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_financial_objective_account
  ON finance.financial_objective (account_id);

COMMENT ON COLUMN finance.financial_objective.account_id IS 'Cuenta bancaria vinculada a la meta (patrimonio).';

-- FK hacia banking.bank_account (ON DELETE SET NULL para no bloquear borrados)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_financial_objective_account'
  ) THEN
    ALTER TABLE finance.financial_objective
      ADD CONSTRAINT fk_financial_objective_account
      FOREIGN KEY (account_id) REFERENCES banking.bank_account (id) ON DELETE SET NULL;
  END IF;
END $$;

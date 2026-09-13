-- ============================================================
-- 20260803-add-transaction-date.sql
-- Fecha de negocio de la transacción, independiente de created_at
-- (timestamp de auditoría / clave de partición).
-- ============================================================

ALTER TABLE finance.transaction_record
  ADD COLUMN IF NOT EXISTS transaction_date DATE NOT NULL DEFAULT CURRENT_DATE;

CREATE INDEX IF NOT EXISTS idx_transaction_user_date
  ON finance.transaction_record (user_id, transaction_date);

COMMENT ON COLUMN finance.transaction_record.transaction_date
  IS 'Fecha de negocio de la transacción (día del movimiento). Independiente de created_at (auditoría/partición). Usar para calendario, agrupación mensual y reportes.';

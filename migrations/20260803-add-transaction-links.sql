-- ============================================================
-- 20260803-add-transaction-links.sql
-- Asociación de transacciones a una meta (financial_objective)
-- y/o a un patrimonio (cuenta bancaria, activo o pasivo).
-- Regla: máximo UN patrimonio por transacción (cuenta, activo o pasivo).
-- ============================================================

ALTER TABLE finance.transaction_record
  ADD COLUMN IF NOT EXISTS objective_id BIGINT,
  ADD COLUMN IF NOT EXISTS account_id   BIGINT,
  ADD COLUMN IF NOT EXISTS asset_id     BIGINT,
  ADD COLUMN IF NOT EXISTS liability_id BIGINT;

-- Máximo un patrimonio por transacción.
ALTER TABLE finance.transaction_record
  DROP CONSTRAINT IF EXISTS chk_transaction_single_patrimony;
ALTER TABLE finance.transaction_record
  ADD CONSTRAINT chk_transaction_single_patrimony
  CHECK (num_nonnulls(account_id, asset_id, liability_id) <= 1);

ALTER TABLE finance.transaction_record
  DROP CONSTRAINT IF EXISTS fk_transaction_objective;
ALTER TABLE finance.transaction_record
  ADD CONSTRAINT fk_transaction_objective
  FOREIGN KEY (objective_id) REFERENCES finance.financial_objective (id)
  ON DELETE SET NULL;

ALTER TABLE finance.transaction_record
  DROP CONSTRAINT IF EXISTS fk_transaction_account;
ALTER TABLE finance.transaction_record
  ADD CONSTRAINT fk_transaction_account
  FOREIGN KEY (account_id) REFERENCES banking.bank_account (id)
  ON DELETE SET NULL;

ALTER TABLE finance.transaction_record
  DROP CONSTRAINT IF EXISTS fk_transaction_asset;
ALTER TABLE finance.transaction_record
  ADD CONSTRAINT fk_transaction_asset
  FOREIGN KEY (asset_id) REFERENCES banking.financial_asset (id)
  ON DELETE SET NULL;

ALTER TABLE finance.transaction_record
  DROP CONSTRAINT IF EXISTS fk_transaction_liability;
ALTER TABLE finance.transaction_record
  ADD CONSTRAINT fk_transaction_liability
  FOREIGN KEY (liability_id) REFERENCES banking.financial_liability (id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transaction_objective
  ON finance.transaction_record (objective_id);
CREATE INDEX IF NOT EXISTS idx_transaction_account
  ON finance.transaction_record (account_id);
CREATE INDEX IF NOT EXISTS idx_transaction_asset
  ON finance.transaction_record (asset_id);
CREATE INDEX IF NOT EXISTS idx_transaction_liability
  ON finance.transaction_record (liability_id);

COMMENT ON COLUMN finance.transaction_record.objective_id
  IS 'Meta asociada (finance.financial_objective). Al vincular, el saldo de la meta se ajusta según el tipo de transacción.';
COMMENT ON COLUMN finance.transaction_record.account_id
  IS 'Cuenta bancaria asociada (banking.bank_account). Máximo un patrimonio por transacción.';
COMMENT ON COLUMN finance.transaction_record.asset_id
  IS 'Activo financiero asociado (banking.financial_asset). Máximo un patrimonio por transacción.';
COMMENT ON COLUMN finance.transaction_record.liability_id
  IS 'Pasivo asociado (banking.financial_liability). Máximo un patrimonio por transacción.';

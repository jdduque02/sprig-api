-- ============================================================
-- 20260807-add-transfer-source-arqueo.sql
--   * finance.transaction_record
--       - nuevo valor 'transfer' en transaction_type_enum
--       - origin_account_id / destination_account_id / transfer_group_id
--         (movimiento bancario: un par de movimientos ligados, origen y
--         destino, compartiendo el mismo transfer_group_id UUID)
--       - source -> 'manual' | 'import' (procedencia del registro) para
--         conciliación de arqueo de caja (app vs extractos)
--   * finance.cash_arqueo -> arqueo de caja (efectivo físico vs registros)
--   * finance.objective_payment -> deleted_at (soft delete) + FK a objetivo
-- ============================================================

-- ── Nuevo valor en transaction_type_enum ───────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    JOIN pg_type t ON t.oid = enumtypid
    WHERE t.typname = 'transaction_type_enum' AND enumlabel = 'transfer'
  ) THEN
    ALTER TYPE transaction_type_enum ADD VALUE 'transfer';
  END IF;
END
$$;

-- ── finance.transaction_record: vínculos de transferencia ──
ALTER TABLE finance.transaction_record
  ADD COLUMN IF NOT EXISTS origin_account_id BIGINT,
  ADD COLUMN IF NOT EXISTS destination_account_id BIGINT,
  ADD COLUMN IF NOT EXISTS transfer_group_id VARCHAR(36);

CREATE INDEX IF NOT EXISTS idx_transaction_transfer_group
  ON finance.transaction_record (transfer_group_id);
CREATE INDEX IF NOT EXISTS idx_transaction_origin_account
  ON finance.transaction_record (origin_account_id);
CREATE INDEX IF NOT EXISTS idx_transaction_destination_account
  ON finance.transaction_record (destination_account_id);

ALTER TABLE finance.transaction_record
  DROP CONSTRAINT IF EXISTS fk_transaction_origin_account;
ALTER TABLE finance.transaction_record
  ADD CONSTRAINT fk_transaction_origin_account
  FOREIGN KEY (origin_account_id) REFERENCES banking.bank_account (id)
  ON DELETE SET NULL;

ALTER TABLE finance.transaction_record
  DROP CONSTRAINT IF EXISTS fk_transaction_destination_account;
ALTER TABLE finance.transaction_record
  ADD CONSTRAINT fk_transaction_destination_account
  FOREIGN KEY (destination_account_id) REFERENCES banking.bank_account (id)
  ON DELETE SET NULL;

-- ── finance.transaction_record: procedencia (app vs extracto) ──
ALTER TABLE finance.transaction_record
  ADD COLUMN IF NOT EXISTS source VARCHAR(30) NOT NULL DEFAULT 'manual';

CREATE INDEX IF NOT EXISTS idx_transaction_source
  ON finance.transaction_record (user_id, source);

-- ── finance.cash_arqueo ────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'cash_arqueo_status_enum'
  ) THEN
    CREATE TYPE cash_arqueo_status_enum AS ENUM ('balanced', 'unbalanced');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS finance.cash_arqueo (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL,
  arqueo_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  counted_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  difference NUMERIC(15, 2) NOT NULL DEFAULT 0,
  status cash_arqueo_status_enum NOT NULL DEFAULT 'unbalanced',
  observations TEXT,
  reconciliation JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cash_arqueo_user
  ON finance.cash_arqueo (user_id, arqueo_date);

COMMENT ON TABLE finance.cash_arqueo
  IS 'Arqueo de caja: compara el efectivo físico contado con el valor esperado reconciliado entre los registros/suscripciones del aplicativo y los extractos cargados del mes.';

-- ── finance.objective_payment: soft delete + FK ────────────
ALTER TABLE finance.objective_payment
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

ALTER TABLE finance.objective_payment
  DROP CONSTRAINT IF EXISTS fk_objective_payment_objective;
ALTER TABLE finance.objective_payment
  ADD CONSTRAINT fk_objective_payment_objective
  FOREIGN KEY (objective_id) REFERENCES finance.financial_objective (id)
  ON DELETE RESTRICT;

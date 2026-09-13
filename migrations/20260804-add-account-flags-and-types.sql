-- ============================================================
-- 20260804-add-account-flags-and-types.sql
-- Nuevo flag de cuenta exenta del impuesto 4x1000 (GMF) y
-- sincronización de tipos de cuenta para bancos específicos:
--   * Nu (alta rentabilidad)  -> ahorro_alto_rendimiento
--   * Pibank (CDT / inversión)-> cdt
-- ============================================================

ALTER TABLE banking.bank_account
  ADD COLUMN IF NOT EXISTS exempt_4x1000 BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN banking.bank_account.exempt_4x1000
  IS 'Cuenta exenta del impuesto 4x1000 (GMF). Solo una por usuario según normativa colombiana.';

CREATE INDEX IF NOT EXISTS idx_bank_account_4x1000
  ON banking.bank_account (exempt_4x1000);

-- Sincronización de tipos de cuenta según la entidad bancaria.
UPDATE banking.bank_account
  SET account_type = 'ahorro_alto_rendimiento'
  WHERE deleted_at IS NULL
    AND account_type = 'ahorros'
    AND lower(bank_name) ILIKE 'nu%';

UPDATE banking.bank_account
  SET account_type = 'cdt'
  WHERE deleted_at IS NULL
    AND account_type = 'ahorros'
    AND lower(bank_name) ILIKE '%pibank%';

-- ============================================================
-- SCRIPT SQL: Tipo de transacción 'investment' + transacciones fijas
-- Fecha: 2026-08-01
-- Base de datos: PostgreSQL 16
-- ============================================================

-- ============================================================
-- 1. Extender transaction_type_enum con 'investment'
-- ============================================================
ALTER TYPE transaction_type_enum ADD VALUE IF NOT EXISTS 'investment';

-- ============================================================
-- 2. Nuevo enum fixed_type_enum (deducción / ingreso fijo)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fixed_type_enum') THEN
    CREATE TYPE fixed_type_enum AS ENUM ('deduction', 'fixed_income');
  END IF;
END
$$;

-- ============================================================
-- 3. Columnas de transacción fija en finance.transaction_record
--    (Las particiones heredan automáticamente las nuevas columnas)
-- ============================================================
ALTER TABLE finance.transaction_record
  ADD COLUMN IF NOT EXISTS is_fixed   BOOLEAN        NOT NULL DEFAULT FALSE;

ALTER TABLE finance.transaction_record
  ADD COLUMN IF NOT EXISTS fixed_type fixed_type_enum;

ALTER TABLE finance.transaction_record
  ADD COLUMN IF NOT EXISTS frequency  frequency_enum;

COMMENT ON COLUMN finance.transaction_record.is_fixed   IS 'Indica si la transacción es fija (deducción o ingreso fijo).';
COMMENT ON COLUMN finance.transaction_record.fixed_type IS 'Tipo de transacción fija: deduction o fixed_income.';
COMMENT ON COLUMN finance.transaction_record.frequency  IS 'Periodicidad de la transacción fija: biweekly o monthly.';

-- ============================================================
-- 4. Símbolo de cotización en banking.financial_asset
--    (para consultar valor de acciones/divisas en internet)
-- ============================================================
ALTER TABLE banking.financial_asset
  ADD COLUMN IF NOT EXISTS symbol       VARCHAR(20);

ALTER TABLE banking.financial_asset
  ADD COLUMN IF NOT EXISTS quote_source VARCHAR(20);

COMMENT ON COLUMN banking.financial_asset.symbol       IS 'Ticker/ símbolo de cotización (ej: NU, USDT, BTC).';
COMMENT ON COLUMN banking.financial_asset.quote_source IS 'Proveedor de cotización: yahoo o coingecko.';

-- ============================================================
-- SCRIPT SQL: Agregar moneda a cuentas bancarias + nuevos tipos
-- Fecha: 2026-07-29
-- Base de datos: PostgreSQL 16
-- ============================================================

-- ============================================================
-- 1. Agregar columna currency a banking.bank_account
-- ============================================================
ALTER TABLE banking.bank_account
  ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'COP';

COMMENT ON COLUMN banking.bank_account.currency IS 'Código de moneda ISO 4217 (COP, USD, EUR, etc.)';

-- ============================================================
-- SCRIPT SQL: Rendimiento anual actual en activos financieros
-- Fecha: 2026-08-02
-- Base de datos: PostgreSQL 16
-- ============================================================

ALTER TABLE banking.financial_asset
  ADD COLUMN IF NOT EXISTS current_yield NUMERIC(5,2);

COMMENT ON COLUMN banking.financial_asset.current_yield IS 'Rendimiento anual actual del activo en porcentaje (ej: 11.50 = 11.5% anual).';

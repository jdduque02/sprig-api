-- ============================================================
-- SCRIPT SQL: Rangos de perfil financiero en categorías + inversión en perfil
-- Fecha: 2026-08-02
-- Base de datos: PostgreSQL 16
-- ============================================================

-- ============================================================
-- 1. catalog.category: profile_bucket (rango del perfil financiero)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'profile_bucket_enum') THEN
    CREATE TYPE catalog.profile_bucket_enum AS ENUM ('needs', 'wants', 'savings', 'investment', 'debt');
  END IF;
END $$;

ALTER TABLE catalog.category
  ADD COLUMN IF NOT EXISTS profile_bucket catalog.profile_bucket_enum;

CREATE INDEX IF NOT EXISTS idx_category_profile_bucket ON catalog.category (profile_bucket);

COMMENT ON COLUMN catalog.category.profile_bucket IS 'Rango del perfil financiero al que pertenece la categoría: needs, wants, savings, investment, debt.';

-- Mapeo por defecto de las categorías existentes
UPDATE catalog.category SET profile_bucket = 'needs'      WHERE name ILIKE 'Salud';
UPDATE catalog.category SET profile_bucket = 'needs'      WHERE name ILIKE 'Educación';
UPDATE catalog.category SET profile_bucket = 'needs'      WHERE name ILIKE 'Impuestos';
UPDATE catalog.category SET profile_bucket = 'needs'      WHERE name ILIKE 'Transporte';
UPDATE catalog.category SET profile_bucket = 'needs'      WHERE name ILIKE 'Alimentación';
UPDATE catalog.category SET profile_bucket = 'needs'      WHERE name ILIKE 'Vivienda';
UPDATE catalog.category SET profile_bucket = 'wants'      WHERE name ILIKE 'Cuidado personal';
UPDATE catalog.category SET profile_bucket = 'wants'      WHERE name ILIKE 'Ropa y accesorios';
UPDATE catalog.category SET profile_bucket = 'wants'      WHERE name ILIKE 'Entretenimiento y ocio';
UPDATE catalog.category SET profile_bucket = 'wants'      WHERE name ILIKE 'Servicios o suscripciones';
UPDATE catalog.category SET profile_bucket = 'savings'    WHERE name ILIKE 'Ahorro e inversiones';
UPDATE catalog.category SET profile_bucket = 'debt'       WHERE name ILIKE 'Deudas y finanzas';

-- ============================================================
-- 2. identity.financial_profile: investment_ratio + constraint
-- ============================================================
ALTER TABLE identity.financial_profile
  ADD COLUMN IF NOT EXISTS investment_ratio NUMERIC(5,2) NOT NULL DEFAULT 10;

ALTER TABLE identity.financial_profile
  DROP CONSTRAINT IF EXISTS ck_ratios_positive;

ALTER TABLE identity.financial_profile
  DROP CONSTRAINT IF EXISTS ck_ratios_max;

ALTER TABLE identity.financial_profile
  ADD CONSTRAINT ck_ratios_positive
  CHECK (needs_ratio >= 0 AND wants_ratio >= 0 AND savings_ratio >= 0 AND investment_ratio >= 0);

ALTER TABLE identity.financial_profile
  ADD CONSTRAINT ck_ratios_max
  CHECK ((needs_ratio + wants_ratio + savings_ratio + investment_ratio) <= 100.00);

COMMENT ON COLUMN identity.financial_profile.investment_ratio IS 'Porcentaje destinado a inversión (perfil financiero).';

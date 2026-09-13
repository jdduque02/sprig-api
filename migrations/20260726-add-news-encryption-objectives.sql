-- ============================================================
-- SCRIPT SQL: Cambios del módulo de metas + encriptación + noticias
-- Fecha: 2026-07-26
-- Base de datos: PostgreSQL 16
-- ============================================================

-- ============================================================
-- 1. NUEVO ESQUEMA: news
-- ============================================================
CREATE SCHEMA IF NOT EXISTS news;

-- ============================================================
-- 2. TABLA: news.news_item
-- ============================================================
CREATE TABLE IF NOT EXISTS news.news_item (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title           VARCHAR(300)  NOT NULL,
  summary         TEXT          NOT NULL,
  content         TEXT,
  category        VARCHAR(100),
  image_url       VARCHAR(1000),
  link            VARCHAR(1000),
  published_at    TIMESTAMP,
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_news_item_title       ON news.news_item (title);
CREATE INDEX IF NOT EXISTS idx_news_item_category    ON news.news_item (category);
CREATE INDEX IF NOT EXISTS idx_news_item_published_at ON news.news_item (published_at DESC NULLS LAST);

COMMENT ON TABLE  news.news_item                     IS 'Noticias financieras consumidas por el frontend';
COMMENT ON COLUMN news.news_item.title               IS 'Título de la noticia';
COMMENT ON COLUMN news.news_item.summary             IS 'Resumen corto de la noticia';
COMMENT ON COLUMN news.news_item.content             IS 'Contenido completo (opcional)';
COMMENT ON COLUMN news.news_item.category            IS 'Categoría: economía, mercados, crypto, etc.';
COMMENT ON COLUMN news.news_item.image_url           IS 'URL de la imagen de la noticia';
COMMENT ON COLUMN news.news_item.link                IS 'Enlace externo a la fuente original';
COMMENT ON COLUMN news.news_item.published_at        IS 'Fecha de publicación de la noticia';

-- ============================================================
-- 3. CAMPOS NUEVOS EN identity.app_user (datos sensibles encriptados)
-- ============================================================
ALTER TABLE identity.app_user
  ADD COLUMN IF NOT EXISTS phone       VARCHAR(500),
  ADD COLUMN IF NOT EXISTS address     VARCHAR(1000),
  ADD COLUMN IF NOT EXISTS full_name   VARCHAR(500),
  ADD COLUMN IF NOT EXISTS document_id VARCHAR(500);

COMMENT ON COLUMN identity.app_user.phone       IS 'Teléfono encriptado (AES-256-GCM, key: ENC_IDENTITY_KEY)';
COMMENT ON COLUMN identity.app_user.address     IS 'Dirección encriptada (AES-256-GCM, key: ENC_IDENTITY_KEY)';
COMMENT ON COLUMN identity.app_user.full_name   IS 'Nombre completo encriptado (AES-256-GCM, key: ENC_IDENTITY_KEY)';
COMMENT ON COLUMN identity.app_user.document_id IS 'Documento de identidad encriptado (AES-256-GCM, key: ENC_IDENTITY_KEY)';

-- ============================================================
-- 4. CAMPOS NUEVOS EN identity.financial_profile
-- ============================================================
ALTER TABLE identity.financial_profile
  ADD COLUMN IF NOT EXISTS monthly_income VARCHAR(500);

COMMENT ON COLUMN identity.financial_profile.monthly_income IS 'Ingreso mensual encriptado (AES-256-GCM, key: ENC_FINANCE_KEY). Almacenado como string cifrado, se desencripta a number en la aplicación.';

-- ============================================================
-- 5. CAMPOS NUEVOS EN finance.financial_objective
-- ============================================================
ALTER TABLE finance.financial_objective
  ADD COLUMN IF NOT EXISTS bank                   VARCHAR(500),
  ADD COLUMN IF NOT EXISTS current_profitability   NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS quota_calculation       JSONB;

COMMENT ON COLUMN finance.financial_objective.bank                  IS 'Banco donde se aloja el ahorro, encriptado (AES-256-GCM, key: ENC_FINANCE_KEY)';
COMMENT ON COLUMN finance.financial_objective.current_profitability IS 'Rentabilidad actual anual del ahorro en porcentaje (ej: 5.5 = 5.5% anual). No se encripta.';
COMMENT ON COLUMN finance.financial_objective.quota_calculation     IS 'Referencia del cálculo de cuota (resultado de POST /calculate-quota). JSON con quota_amount, total_periods, has_financial_profile, is_within_budget, warnings, recommendations.';

-- ============================================================
-- 6. EXTENSIÓN DEL ENUM frequency_enum (agregar biweekly)
-- ============================================================
-- TypeORM sincroniza el enum en development (synchronize: true).
-- En producción, ejecutar el siguiente bloque:
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'frequency_enum' AND e.enumlabel = 'biweekly'
  ) THEN
    ALTER TYPE finance.frequency_enum ADD VALUE 'biweekly' BEFORE 'monthly';
  END IF;
END
$$;

-- ============================================================
-- 7. FUNCIÓN DE AUDITORÍA AUTOMÁTICA (trigger)
-- ============================================================
-- Opcional: Si se desea registrar automáticamente los INSERT/UPDATE/DELETE
-- en audit.audit_log sin hacerlo desde la aplicación.
-- Descomentar si se necesita:

/*
CREATE OR REPLACE FUNCTION audit.fn_audit_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_record_id BIGINT;
  v_old_data  JSONB;
  v_new_data  JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_record_id := (NEW).id;
    v_new_data  := to_jsonb(NEW);
    INSERT INTO audit.audit_log (schema_name, table_name, record_id, action, new_data)
    VALUES (TG_TABLE_SCHEMA, TG_TABLE_NAME, v_record_id, 'INSERT', v_new_data);
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    v_record_id := (NEW).id;
    v_old_data  := to_jsonb(OLD);
    v_new_data  := to_jsonb(NEW);
    INSERT INTO audit.audit_log (schema_name, table_name, record_id, action, old_data, new_data)
    VALUES (TG_TABLE_SCHEMA, TG_TABLE_NAME, v_record_id, 'UPDATE', v_old_data, v_new_data);
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    v_record_id := (OLD).id;
    v_old_data  := to_jsonb(OLD);
    INSERT INTO audit.audit_log (schema_name, table_name, record_id, action, old_data)
    VALUES (TG_TABLE_SCHEMA, TG_TABLE_NAME, v_record_id, 'DELETE', v_old_data);
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Ejemplo: trigger en financial_objective
CREATE TRIGGER trg_audit_financial_objective
  AFTER INSERT OR UPDATE OR DELETE ON finance.financial_objective
  FOR EACH ROW EXECUTE FUNCTION audit.fn_audit_trigger();

-- Ejemplo: trigger en app_user
CREATE TRIGGER trg_audit_app_user
  AFTER INSERT OR UPDATE OR DELETE ON identity.app_user
  FOR EACH ROW EXECUTE FUNCTION audit.fn_audit_trigger();
*/

-- ============================================================
-- FIN DEL SCRIPT
-- ============================================================

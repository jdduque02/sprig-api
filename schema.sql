-- ============================================================
-- SCHEMA COMPLETO: api-cost-manager
-- Base de datos: PostgreSQL 16
-- Generado: 2026-08-16
-- Total: 9 schemas, 11 enums, 26 tablas
-- ============================================================
-- USO:
--   psql -U <usuario> -d <database> -f schema.sql
-- ============================================================

-- ============================================================
-- 0. EXTENSIONES NECESARIAS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1. SCHEMAS
-- ============================================================
CREATE SCHEMA IF NOT EXISTS identity;
CREATE SCHEMA IF NOT EXISTS finance;
CREATE SCHEMA IF NOT EXISTS banking;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS catalog;
CREATE SCHEMA IF NOT EXISTS intelligence;
CREATE SCHEMA IF NOT EXISTS news;
CREATE SCHEMA IF NOT EXISTS mail;
CREATE SCHEMA IF NOT EXISTS support;

-- ============================================================
-- 2. TIPOS ENUM
-- ============================================================

-- transaction_type_enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_type_enum') THEN
    CREATE TYPE transaction_type_enum AS ENUM ('income', 'expense', 'investment', 'transfer');
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'transaction_type_enum' AND e.enumlabel = 'investment'
    ) THEN
      ALTER TYPE transaction_type_enum ADD VALUE 'investment';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'transaction_type_enum' AND e.enumlabel = 'transfer'
    ) THEN
      ALTER TYPE transaction_type_enum ADD VALUE 'transfer';
    END IF;
  END IF;
END
$$;

-- profile_bucket_enum (rango del perfil financiero)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'profile_bucket_enum') THEN
    CREATE TYPE profile_bucket_enum AS ENUM ('needs', 'wants', 'savings', 'investment', 'debt');
  END IF;
END
$$;

-- fixed_type_enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fixed_type_enum') THEN
    CREATE TYPE fixed_type_enum AS ENUM ('deduction', 'fixed_income');
  END IF;
END
$$;

-- payment_method_enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method_enum') THEN
    CREATE TYPE payment_method_enum AS ENUM (
      'bank_transfer', 'cash', 'debit_card', 'credit_card',
      'digital_wallet', 'mobile_payment', 'check', 'crypto'
    );
  END IF;
END
$$;

-- financial_objective_type_enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'financial_objective_type_enum') THEN
    CREATE TYPE financial_objective_type_enum AS ENUM ('loan', 'savings', 'goal', 'emergency_fund');
  ELSE
    -- Agregar 'emergency_fund' si no existe (bases ya instaladas antes de
    -- este cambio). Ver también migrations/20260913-add-emergency-fund-objective-type.sql.
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'financial_objective_type_enum' AND e.enumlabel = 'emergency_fund'
    ) THEN
      ALTER TYPE financial_objective_type_enum ADD VALUE 'emergency_fund';
    END IF;
  END IF;
END
$$;

-- frequency_enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'frequency_enum') THEN
    CREATE TYPE frequency_enum AS ENUM (
      'daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'
    );
  ELSE
    -- Agregar 'biweekly' si no existe
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'frequency_enum' AND e.enumlabel = 'biweekly'
    ) THEN
      ALTER TYPE frequency_enum ADD VALUE 'biweekly' BEFORE 'monthly';
    END IF;
  END IF;
END
$$;

-- audit_action_enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_action_enum') THEN
    CREATE TYPE audit_action_enum AS ENUM ('INSERT', 'UPDATE', 'DELETE');
  END IF;
END
$$;

-- review_status_enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'review_status_enum') THEN
    CREATE TYPE review_status_enum AS ENUM ('categorized', 'pending');
  END IF;
END
$$;

-- ============================================================
-- 3. SCHEMA: identity
-- ============================================================

-- ── identity.app_user ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS identity.app_user (
  id                     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  external_id            VARCHAR(36)   UNIQUE,
  username               CITEXT        NOT NULL UNIQUE,
  email                  CITEXT        NOT NULL UNIQUE,
  locale                 VARCHAR(10)   NOT NULL DEFAULT 'es-CO',
  timezone               VARCHAR(50)   NOT NULL DEFAULT 'America/Bogota',
  metadata               JSONB         NOT NULL DEFAULT '{}',
  created_at             TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             TIMESTAMP,
  deleted_at             TIMESTAMP,
  is_active              BOOLEAN       NOT NULL DEFAULT TRUE,
  -- Campos sensibles (encriptados con AES-256-GCM en capa de servicio)
  phone                  VARCHAR(500),
  address                VARCHAR(1000),
  full_name              VARCHAR(500),
  document_id            VARCHAR(500),
  -- Último login registrado por la API + snapshot de roles Keycloak
  last_login_at          TIMESTAMP,
  roles                  JSONB         NOT NULL DEFAULT '[]',
  -- FK inversa para OneToOne con financial_profile
  financial_profile_id   BIGINT
);

CREATE INDEX IF NOT EXISTS idx_user_external_id  ON identity.app_user (external_id);
CREATE INDEX IF NOT EXISTS idx_user_email        ON identity.app_user (email);
CREATE INDEX IF NOT EXISTS idx_user_active       ON identity.app_user (is_active);
CREATE INDEX IF NOT EXISTS idx_user_last_login_at ON identity.app_user (last_login_at DESC NULLS LAST);

COMMENT ON TABLE  identity.app_user IS 'Usuarios de la plataforma. Datos sensibles cifrados con AES-256-GCM.';
COMMENT ON COLUMN identity.app_user.phone       IS 'Telefono cifrado (AES-256-GCM)';
COMMENT ON COLUMN identity.app_user.address     IS 'Direccion cifrada (AES-256-GCM)';
COMMENT ON COLUMN identity.app_user.full_name   IS 'Nombre completo cifrado (AES-256-GCM)';
COMMENT ON COLUMN identity.app_user.document_id IS 'Documento de identidad cifrado (AES-256-GCM)';

-- ── identity.financial_profile ──────────────────────────────
CREATE TABLE IF NOT EXISTS identity.financial_profile (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id           BIGINT        NOT NULL,
  profile_name      VARCHAR(50)   NOT NULL DEFAULT '50-30-20',
  is_custom         BOOLEAN       NOT NULL DEFAULT FALSE,
  needs_ratio       NUMERIC(5,2)  NOT NULL DEFAULT 50,
  wants_ratio       NUMERIC(5,2)  NOT NULL DEFAULT 30,
  savings_ratio     NUMERIC(5,2)  NOT NULL DEFAULT 20,
  investment_ratio  NUMERIC(5,2)  NOT NULL DEFAULT 10,
  max_debt_ratio    NUMERIC(5,2)  NOT NULL DEFAULT 40,
  metadata          JSONB         NOT NULL DEFAULT '{}',
  monthly_income    VARCHAR(500),   -- Encriptado (AES-256-GCM)
  created_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP,

  CONSTRAINT ck_ratios_positive
    CHECK (needs_ratio >= 0 AND wants_ratio >= 0 AND savings_ratio >= 0 AND investment_ratio >= 0),
  CONSTRAINT ck_ratios_max
    CHECK ((needs_ratio + wants_ratio + savings_ratio + investment_ratio) <= 100.00),

  CONSTRAINT fk_financial_profile_user
    FOREIGN KEY (user_id) REFERENCES identity.app_user(id) ON DELETE CASCADE
);

COMMENT ON TABLE  identity.financial_profile IS 'Perfiles financieros (50-30-20, personalizados). Relacion 1:1 con app_user.';
COMMENT ON COLUMN identity.financial_profile.monthly_income IS 'Ingreso mensual cifrado (AES-256-GCM)';

-- FK bidireccional OneToOne: app_user.financial_profile_id
ALTER TABLE identity.app_user
  ADD CONSTRAINT fk_app_user_financial_profile
  FOREIGN KEY (financial_profile_id) REFERENCES identity.financial_profile(id)
  ON DELETE SET NULL;

-- ============================================================
-- 4. SCHEMA: finance
-- ============================================================

-- ── finance.transaction_record (PARTICIONADA por RANGE trimestral) ──
CREATE TABLE IF NOT EXISTS finance.transaction_record (
  id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id               BIGINT                  NOT NULL,
  category_id           BIGINT,
  category_status       review_status_enum       NOT NULL DEFAULT 'categorized',
  installments          SMALLINT,
  installment_value     NUMERIC(15,2),
  subcategory_id        BIGINT,
  type                  transaction_type_enum   NOT NULL,
  amount                NUMERIC(15,2)           NOT NULL,
  is_fixed              BOOLEAN                 NOT NULL DEFAULT FALSE,
  fixed_type            fixed_type_enum,
  frequency             frequency_enum,
  due_day               SMALLINT,
  reminder_days         SMALLINT                NOT NULL DEFAULT 3,
  payment_method        payment_method_enum,
  description           TEXT,
  reference_code        VARCHAR(100),
  attachments           TEXT[]                  DEFAULT '{}',
  source_account        VARCHAR(100),
  destination_account   VARCHAR(100),
  source_bank           VARCHAR(100),
  destination_bank      VARCHAR(100),
  origin_account_id     BIGINT,
  destination_account_id BIGINT,
  transfer_group_id     VARCHAR(36),
  source                VARCHAR(30)             NOT NULL DEFAULT 'manual',
  addressee             VARCHAR(200),
  transaction_date      DATE                    NOT NULL DEFAULT CURRENT_DATE,
  objective_id          BIGINT,
  account_id            BIGINT,
  asset_id              BIGINT,
  liability_id          BIGINT,
  created_at            TIMESTAMP               NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP,
  deleted_at            TIMESTAMP,

  -- Máximo un patrimonio (cuenta, activo o pasivo) por transacción.
  -- Las FK hacia financial_objective/bank_account/financial_asset/
  -- financial_liability se agregan al final del esquema (ALTER TABLE).
  CONSTRAINT chk_transaction_single_patrimony
    CHECK (num_nonnulls(account_id, asset_id, liability_id) <= 1)
) PARTITION BY RANGE (created_at);

-- Particiones trimestrales (ejemplo: Q1-Q4 2026)
CREATE TABLE IF NOT EXISTS finance.transaction_record_2026_q1
  PARTITION OF finance.transaction_record
  FOR VALUES FROM ('2026-01-01') TO ('2026-04-01');

CREATE TABLE IF NOT EXISTS finance.transaction_record_2026_q2
  PARTITION OF finance.transaction_record
  FOR VALUES FROM ('2026-04-01') TO ('2026-07-01');

CREATE TABLE IF NOT EXISTS finance.transaction_record_2026_q3
  PARTITION OF finance.transaction_record
  FOR VALUES FROM ('2026-07-01') TO ('2026-10-01');

CREATE TABLE IF NOT EXISTS finance.transaction_record_2026_q4
  PARTITION OF finance.transaction_record
  FOR VALUES FROM ('2026-10-01') TO ('2027-01-01');

CREATE INDEX IF NOT EXISTS idx_transaction_user         ON finance.transaction_record (user_id);
CREATE INDEX IF NOT EXISTS idx_transaction_user_created ON finance.transaction_record (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_transaction_user_date    ON finance.transaction_record (user_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_transaction_category     ON finance.transaction_record (category_id);
CREATE INDEX IF NOT EXISTS idx_transaction_type         ON finance.transaction_record (type);
CREATE INDEX IF NOT EXISTS idx_transaction_objective    ON finance.transaction_record (objective_id);
CREATE INDEX IF NOT EXISTS idx_transaction_account      ON finance.transaction_record (account_id);
CREATE INDEX IF NOT EXISTS idx_transaction_asset        ON finance.transaction_record (asset_id);
CREATE INDEX IF NOT EXISTS idx_transaction_liability    ON finance.transaction_record (liability_id);
CREATE INDEX IF NOT EXISTS idx_transaction_category_status ON finance.transaction_record (user_id, category_status);
CREATE INDEX IF NOT EXISTS idx_transaction_description  ON finance.transaction_record (user_id, lower(description));
CREATE INDEX IF NOT EXISTS idx_transaction_transfer_group ON finance.transaction_record (transfer_group_id);
CREATE INDEX IF NOT EXISTS idx_transaction_origin_account ON finance.transaction_record (origin_account_id);
CREATE INDEX IF NOT EXISTS idx_transaction_destination_account ON finance.transaction_record (destination_account_id);
CREATE INDEX IF NOT EXISTS idx_transaction_source ON finance.transaction_record (user_id, source);

COMMENT ON TABLE finance.transaction_record IS 'Registro de transacciones particionado por trimestre. SIEMPRE incluir created_at en WHERE.';

-- ── finance.transaction_category_rule ───────────────────────
CREATE TABLE IF NOT EXISTS finance.transaction_category_rule (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL,
  normalized_description TEXT NOT NULL,
  category_id BIGINT NOT NULL,
  subcategory_id BIGINT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP,
  CONSTRAINT uq_transaction_category_rule
    UNIQUE (user_id, normalized_description),
  CONSTRAINT fk_transaction_category_rule_category
    FOREIGN KEY (category_id) REFERENCES catalog.category (id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_transaction_category_rule_user
  ON finance.transaction_category_rule (user_id, normalized_description);

COMMENT ON TABLE finance.transaction_category_rule
  IS 'Reglas de auto-categorización: descripción normalizada de la transacción -> categoría asignada por el usuario.';

-- ── identity.password_reset_otp ─────────────────────────────
CREATE TABLE IF NOT EXISTS identity.password_reset_otp (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  consumed_at TIMESTAMP,
  attempts INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_password_reset_otp_user
    FOREIGN KEY (user_id) REFERENCES identity.app_user (id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_password_reset_otp_user
  ON identity.password_reset_otp (user_id, created_at DESC);

COMMENT ON TABLE identity.password_reset_otp
  IS 'Códigos OTP de recuperación de contraseña. Se almacena hash SHA-256, nunca el código en claro.';

-- ── mail.email_template ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS mail.email_template (
  key VARCHAR(60) PRIMARY KEY,
  subject VARCHAR(255) NOT NULL,
  html_body TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP,
  CONSTRAINT chk_email_template_subject
    CHECK (char_length(subject) BETWEEN 1 AND 255)
);

COMMENT ON TABLE mail.email_template
  IS 'Plantillas de correo personalizables desde el editor react.email (Inspector). key identifica el tipo de email.';

-- ── finance.objective_payment ───────────────────────────────
CREATE TABLE IF NOT EXISTS finance.objective_payment (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  objective_id    BIGINT          NOT NULL,
  user_id         BIGINT          NOT NULL,
  amount          NUMERIC(15,2)   NOT NULL,
  payment_date    DATE            NOT NULL,
  note            TEXT,
  created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_objective_payment_objective ON finance.objective_payment (objective_id);
CREATE INDEX IF NOT EXISTS idx_objective_payment_user      ON finance.objective_payment (user_id);

-- cash_arqueo_status_enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cash_arqueo_status_enum') THEN
    CREATE TYPE cash_arqueo_status_enum AS ENUM ('balanced', 'unbalanced');
  END IF;
END
$$;

-- ── finance.cash_arqueo (arqueo de caja: app vs extractos) ──
CREATE TABLE IF NOT EXISTS finance.cash_arqueo (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id          BIGINT              NOT NULL,
  arqueo_date      DATE                NOT NULL DEFAULT CURRENT_DATE,
  expected_amount  NUMERIC(15,2)       NOT NULL DEFAULT 0,
  counted_amount   NUMERIC(15,2)       NOT NULL DEFAULT 0,
  difference       NUMERIC(15,2)       NOT NULL DEFAULT 0,
  status           cash_arqueo_status_enum NOT NULL DEFAULT 'unbalanced',
  observations     TEXT,
  reconciliation   JSONB,
  created_at       TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP,
  deleted_at       TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cash_arqueo_user ON finance.cash_arqueo (user_id, arqueo_date);

-- ── finance.notification ────────────────────────────────────
CREATE TABLE IF NOT EXISTS finance.notification (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id         BIGINT          NOT NULL,
  title           VARCHAR(100)    NOT NULL,
  description     TEXT,
  is_read         BOOLEAN         NOT NULL DEFAULT FALSE,
  is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
  scheduled_at    TIMESTAMP,
  reference       VARCHAR(120),
  created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notification_user   ON finance.notification (user_id);
CREATE INDEX IF NOT EXISTS idx_notification_unread ON finance.notification (is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notification_reference ON finance.notification (user_id, reference);

-- ── finance.financial_period ────────────────────────────────
CREATE TABLE IF NOT EXISTS finance.financial_period (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id         BIGINT          NOT NULL,
  year            SMALLINT        NOT NULL,
  month           SMALLINT        NOT NULL,
  is_closed       BOOLEAN         NOT NULL DEFAULT FALSE,
  closed_at       TIMESTAMP,
  created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT uq_financial_period_user_year_month UNIQUE (user_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_financial_period_user ON finance.financial_period (user_id);

-- ── finance.financial_objective ─────────────────────────────
CREATE TABLE IF NOT EXISTS finance.financial_objective (
  id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id                 BIGINT                            NOT NULL,
  category_id             BIGINT,
  subcategory_id          BIGINT,
  name                    VARCHAR(200)                      NOT NULL,
  type                    financial_objective_type_enum     NOT NULL,
  target_amount           NUMERIC(15,2),                  -- Nullable: metas abiertas sin monto objetivo
  current_balance         NUMERIC(15,2)                     NOT NULL DEFAULT 0,
  interest_rate           NUMERIC(5,2),
  fees                    NUMERIC(15,2),
  monthly_payment         NUMERIC(15,2),
  owner                   VARCHAR(100),
  bank                    VARCHAR(500),                       -- Encriptado (AES-256-GCM)
  current_profitability   NUMERIC(5,2),
  account_id              BIGINT,
  frequency               frequency_enum,
  due_day                 SMALLINT,
  start_date              DATE,
  end_date                DATE,
  is_completed            BOOLEAN         NOT NULL DEFAULT FALSE,
  quota_calculation       JSONB,
  completed_at            TIMESTAMP,
  created_at              TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              TIMESTAMP,
  deleted_at              TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_financial_objective_user ON finance.financial_objective (user_id);
CREATE INDEX IF NOT EXISTS idx_financial_objective_type ON finance.financial_objective (type);
CREATE INDEX IF NOT EXISTS idx_financial_objective_account ON finance.financial_objective (account_id);

COMMENT ON COLUMN finance.financial_objective.bank                  IS 'Banco cifrado (AES-256-GCM)';
COMMENT ON COLUMN finance.financial_objective.current_profitability  IS 'Rentabilidad anual vigente (ej: 11.50 = 11.5%)';
COMMENT ON COLUMN finance.financial_objective.quota_calculation     IS 'Resultado del ultimo calculo de cuota (reference, no creado)';
COMMENT ON COLUMN finance.financial_objective.account_id            IS 'Cuenta bancaria vinculada a la meta (patrimonio).';

-- ── finance.category_budget (presupuesto manual por categoría/periodo) ──
-- Tabla de configuración de bajo volumen (no transaccional, no
-- particionada): no toca ni afecta el particionamiento de
-- finance.transaction_record. category_id/subcategory_id sin FK física
-- a catalog.* (aislamiento entre esquemas, igual que transaction_record).
CREATE TABLE IF NOT EXISTS finance.category_budget (
  id                       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id                  BIGINT          NOT NULL,
  category_id              BIGINT          NOT NULL,
  subcategory_id           BIGINT,
  year                     SMALLINT        NOT NULL,
  month                    SMALLINT        NOT NULL,
  limit_amount             NUMERIC(15,2)   NOT NULL,
  currency                 VARCHAR(3)      NOT NULL DEFAULT 'COP',
  alert_threshold_percent  NUMERIC(5,2)    NOT NULL DEFAULT 80,
  is_active                BOOLEAN         NOT NULL DEFAULT TRUE,
  created_at               TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at               TIMESTAMP,
  deleted_at               TIMESTAMP,

  CONSTRAINT uq_category_budget_user_category_period
    UNIQUE (user_id, category_id, subcategory_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_category_budget_user ON finance.category_budget (user_id);
CREATE INDEX IF NOT EXISTS idx_category_budget_category ON finance.category_budget (category_id);
CREATE INDEX IF NOT EXISTS idx_category_budget_active ON finance.category_budget (is_active);

-- Refuerzo a nivel de esquema del caso subcategory_id IS NULL, que el
-- UNIQUE constraint de arriba no cubre (Postgres trata cada NULL como
-- distinto en un UNIQUE). Complementa el control ya existente a nivel
-- de aplicación (ConflictException en CategoryBudgetRepository).
-- Excluye filas con deleted_at (borrado lógico): una fila borrada no debe
-- seguir bloqueando un presupuesto nuevo para el mismo user/category/periodo.
CREATE UNIQUE INDEX IF NOT EXISTS uq_category_budget_user_category_period_null_subcat
  ON finance.category_budget (user_id, category_id, year, month)
  WHERE subcategory_id IS NULL AND deleted_at IS NULL;

COMMENT ON TABLE finance.category_budget
  IS 'Presupuesto manual por categoría/subcategoría/periodo definido por el usuario (no derivado de 50/30/20). category_id/subcategory_id sin FK física a catalog.* (aislamiento entre esquemas, igual que transaction_record).';

COMMENT ON COLUMN finance.category_budget.category_id
  IS 'Referencia lógica a catalog.category.id, resuelta vía CategoryService. Sin FK física (esquemas separados, convención del repo).';

COMMENT ON COLUMN finance.category_budget.subcategory_id
  IS 'Referencia lógica a catalog.subcategory.id, resuelta vía SubcategoryService. Sin FK física. Nullable: presupuesto puede ser a nivel de categoría completa.';

-- statement_import_status_enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'statement_import_status_enum') THEN
    CREATE TYPE statement_import_status_enum AS ENUM (
      'pending', 'processing', 'completed', 'partial', 'failed'
    );
  END IF;
END
$$;

-- ── finance.statement_import (lote de importacion de extractos) ──
CREATE TABLE IF NOT EXISTS finance.statement_import (
  id                         BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  user_id                    BIGINT NOT NULL,
  status                     statement_import_status_enum NOT NULL DEFAULT 'pending',
  total_files                INT NOT NULL DEFAULT 0,
  processed_files            INT NOT NULL DEFAULT 0,
  success_files              INT NOT NULL DEFAULT 0,
  failed_files               INT NOT NULL DEFAULT 0,
  total_records_parsed       INT NOT NULL DEFAULT 0,
  total_records_created      INT NOT NULL DEFAULT 0,
  total_records_skipped      INT NOT NULL DEFAULT 0,
  total_records_failed       INT NOT NULL DEFAULT 0,
  total_records_uncategorized INT NOT NULL DEFAULT 0,
  options                    JSONB NOT NULL DEFAULT '{}',
  error                      JSONB,
  created_at                 TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                 TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_statement_import_user
  ON finance.statement_import (user_id, created_at DESC);

COMMENT ON COLUMN finance.statement_import.options
  IS 'Opciones de la carga (default_category_id, account_id, skip_duplicates, default_type). NUNCA almacenar contrasenas de PDF.';

-- ── finance.statement_import_file (archivo individual del lote) ──
CREATE TABLE IF NOT EXISTS finance.statement_import_file (
  id                  BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  import_id           BIGINT NOT NULL,
  filename            VARCHAR(255) NOT NULL,
  mimetype            VARCHAR(100) NOT NULL DEFAULT '',
  size_bytes          BIGINT NOT NULL DEFAULT 0,
  storage_path        TEXT,
  status              VARCHAR(20) NOT NULL DEFAULT 'pending',
  records_parsed      INT NOT NULL DEFAULT 0,
  records_created     INT NOT NULL DEFAULT 0,
  records_skipped     INT NOT NULL DEFAULT 0,
  records_uncategorized INT NOT NULL DEFAULT 0,
  error_code          VARCHAR(60),
  error_message       TEXT,
  processed_at        TIMESTAMP,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP,

  CONSTRAINT fk_statement_import_file_import
    FOREIGN KEY (import_id) REFERENCES finance.statement_import (id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_statement_import_file_import
  ON finance.statement_import_file (import_id);

COMMENT ON COLUMN finance.statement_import_file.storage_path
  IS 'Ruta temporal del archivo en disco mientras se procesa el lote. Se elimina al terminar.';

-- ============================================================
-- 5. SCHEMA: banking
-- ============================================================

-- ── banking.bank_account ────────────────────────────────────
CREATE TABLE IF NOT EXISTS banking.bank_account (
  id                         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id                    BIGINT      NOT NULL,
  bank_name                  VARCHAR(100) NOT NULL,
  account_type               VARCHAR(50)  NOT NULL,
  encrypted_account_number   VARCHAR(500),   -- AES-256-GCM (EncryptionService)
  encrypted_balance          VARCHAR(500),   -- AES-256-GCM (EncryptionService)
  currency                   VARCHAR(3)   NOT NULL DEFAULT 'COP',
  annual_interest_rate       NUMERIC(5,2),
  yield_frequency            VARCHAR(10)  NOT NULL DEFAULT 'monthly',
  exempt_4x1000              BOOLEAN      NOT NULL DEFAULT FALSE,
  is_primary                 BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at                 TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                 TIMESTAMP,
  deleted_at                 TIMESTAMP,

  CONSTRAINT chk_yield_frequency
    CHECK (yield_frequency IN ('daily', 'monthly', 'annual'))
);

CREATE INDEX IF NOT EXISTS idx_bank_account_user    ON banking.bank_account (user_id);
CREATE INDEX IF NOT EXISTS idx_bank_account_primary ON banking.bank_account (is_primary);
CREATE INDEX IF NOT EXISTS idx_bank_account_4x1000  ON banking.bank_account (exempt_4x1000);

COMMENT ON TABLE  banking.bank_account IS 'Cuentas bancarias. Datos sensibles cifrados con AES-256-GCM (EncryptionService).';
COMMENT ON COLUMN banking.bank_account.encrypted_account_number IS 'Numero de cuenta cifrado con AES-256-GCM (EncryptionService).';
COMMENT ON COLUMN banking.bank_account.encrypted_balance        IS 'Saldo cifrado con AES-256-GCM (EncryptionService).';
COMMENT ON COLUMN banking.bank_account.annual_interest_rate     IS 'Tasa de interes anual de la cuenta en porcentaje (ej: 4.50 = 4.5% anual).';
COMMENT ON COLUMN banking.bank_account.yield_frequency          IS 'Frecuencia de rendimiento: daily, monthly o annual.';
COMMENT ON COLUMN banking.bank_account.exempt_4x1000            IS 'Cuenta exenta del impuesto 4x1000 (GMF). Solo una por usuario segun normativa colombiana.';

-- ── banking.financial_asset ─────────────────────────────────
CREATE TABLE IF NOT EXISTS banking.financial_asset (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id         BIGINT          NOT NULL,
  asset_type      VARCHAR(50)     NOT NULL,
  name            VARCHAR(100)    NOT NULL,
  current_value   NUMERIC(15,2)   NOT NULL,
  current_yield   NUMERIC(5,2),
  currency        VARCHAR(3)      NOT NULL DEFAULT 'COP',
  symbol          VARCHAR(20),
  quote_source    VARCHAR(20),
  encrypted_data  BYTEA,          -- pgp_sym_encrypt
  created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP,
  deleted_at      TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_financial_asset_user ON banking.financial_asset (user_id);
CREATE INDEX IF NOT EXISTS idx_financial_asset_type ON banking.financial_asset (asset_type);

COMMENT ON TABLE  banking.financial_asset IS 'Activos financieros. Datos cifrados con pgcrypto.';
COMMENT ON COLUMN banking.financial_asset.current_yield IS 'Rendimiento anual actual del activo en porcentaje (ej: 11.50 = 11.5% anual).';
COMMENT ON COLUMN banking.financial_asset.symbol       IS 'Ticker/símbolo de cotización (ej: NU, USDT, BTC).';
COMMENT ON COLUMN banking.financial_asset.quote_source IS 'Proveedor de cotización: yahoo o coingecko.';
COMMENT ON COLUMN banking.financial_asset.encrypted_data IS 'Datos adicionales cifrados con pgp_sym_encrypt';

-- ── banking.financial_liability ─────────────────────────────
CREATE TABLE IF NOT EXISTS banking.financial_liability (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id           BIGINT          NOT NULL,
  liability_type    VARCHAR(50)     NOT NULL,
  name              VARCHAR(100)    NOT NULL,
  current_balance   NUMERIC(15,2)   NOT NULL,
  interest_rate     NUMERIC(5,2),
  currency          VARCHAR(3)      NOT NULL DEFAULT 'COP',
  encrypted_data    BYTEA,          -- pgp_sym_encrypt
  created_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP,
  deleted_at        TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_financial_liability_user ON banking.financial_liability (user_id);
CREATE INDEX IF NOT EXISTS idx_financial_liability_type ON banking.financial_liability (liability_type);

COMMENT ON TABLE  banking.financial_liability IS 'Pasivos financieros. Datos cifrados con pgcrypto.';
COMMENT ON COLUMN banking.financial_liability.encrypted_data IS 'Datos adicionales cifrados con pgp_sym_encrypt';

-- ============================================================
-- 6. SCHEMA: audit
-- ============================================================

-- ── audit.audit_log ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit.audit_log (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  schema_name   TEXT              NOT NULL,
  table_name    TEXT              NOT NULL,
  record_id     BIGINT            NOT NULL,
  action        audit_action_enum NOT NULL,
  old_data      JSONB,
  new_data      JSONB,
  changed_by    BIGINT,           -- NULL = proceso automatizado (trigger)
  created_at    TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_log_schema_table ON audit.audit_log (schema_name, table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_record       ON audit.audit_log (record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_by   ON audit.audit_log (changed_by);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at   ON audit.audit_log (created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_action       ON audit.audit_log (action);

COMMENT ON TABLE audit.audit_log IS 'Registro de auditoria. changed_by NULL indica trigger automatico.';

-- ============================================================
-- 7. SCHEMA: catalog
-- ============================================================

-- ── catalog.category ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS catalog.category (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          VARCHAR(100)    NOT NULL,
  group_type    transaction_type_enum NOT NULL,
  profile_bucket catalog.profile_bucket_enum,
  icon_key      VARCHAR(50),
  color_hex     VARCHAR(7),
  sort_order    INT             NOT NULL DEFAULT 0,
  created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP,
  is_active     BOOLEAN         NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_category_group_type ON catalog.category (group_type);
CREATE INDEX IF NOT EXISTS idx_category_profile_bucket ON catalog.category (profile_bucket);
CREATE INDEX IF NOT EXISTS idx_category_active     ON catalog.category (is_active);

-- ── catalog.subcategory ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS catalog.subcategory (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category_id   BIGINT          NOT NULL,
  user_id       BIGINT          NOT NULL,
  name          VARCHAR(100)    NOT NULL,
  icon_key      VARCHAR(50),
  color_hex     VARCHAR(7),
  created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP,
  is_active     BOOLEAN         NOT NULL DEFAULT TRUE,

  CONSTRAINT uq_subcategory_user_category_name UNIQUE (user_id, category_id, name),
  CONSTRAINT fk_subcategory_category
    FOREIGN KEY (category_id) REFERENCES catalog.category(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_subcategory_category ON catalog.subcategory (category_id);
CREATE INDEX IF NOT EXISTS idx_subcategory_user     ON catalog.subcategory (user_id);

-- ============================================================
-- 8. SCHEMA: intelligence
-- ============================================================

-- ── intelligence.financial_summary ──────────────────────────
CREATE TABLE IF NOT EXISTS intelligence.financial_summary (
  id                        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id                   BIGINT        NOT NULL,
  financial_period_id       BIGINT        NOT NULL,
  profile_id                BIGINT        NOT NULL,
  total_income              NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_expense             NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_debt                NUMERIC(15,2) NOT NULL DEFAULT 0,
  net_worth                 NUMERIC(15,2) NOT NULL DEFAULT 0,
  expense_ratio             NUMERIC(5,2),
  debt_ratio                NUMERIC(5,2),
  savings_rate              NUMERIC(5,2),
  recommended_max_expense   NUMERIC(15,2),
  recommended_savings       NUMERIC(15,2),
  is_over_spending          BOOLEAN       NOT NULL DEFAULT FALSE,
  is_over_indebted          BOOLEAN       NOT NULL DEFAULT FALSE,
  insights                  JSONB         DEFAULT '[]',
  calculated_at             TIMESTAMP,
  is_final                  BOOLEAN       NOT NULL DEFAULT FALSE,
  deleted_at                TIMESTAMP,

  CONSTRAINT uq_financial_summary_user_period UNIQUE (user_id, financial_period_id)
);

CREATE INDEX IF NOT EXISTS idx_financial_summary_user   ON intelligence.financial_summary (user_id);
CREATE INDEX IF NOT EXISTS idx_financial_summary_period ON intelligence.financial_summary (financial_period_id);
CREATE INDEX IF NOT EXISTS idx_financial_summary_final  ON intelligence.financial_summary (is_final);

COMMENT ON TABLE intelligence.financial_summary IS 'Resumen financiero mensual. Registros con is_final=TRUE no deben recalcularse.';

-- ── intelligence.summary_category_breakdown ─────────────────
CREATE TABLE IF NOT EXISTS intelligence.summary_category_breakdown (
  id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  summary_id            BIGINT        NOT NULL,
  category_id           BIGINT        NOT NULL,
  total_amount          NUMERIC(15,2) NOT NULL DEFAULT 0,
  transaction_count     INT           NOT NULL DEFAULT 0,
  percentage_of_income  NUMERIC(5,2),
  optimum_percentage    NUMERIC(5,2),
  is_over_budget        BOOLEAN       NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_summary_breakdown_summary  ON intelligence.summary_category_breakdown (summary_id);
CREATE INDEX IF NOT EXISTS idx_summary_breakdown_category ON intelligence.summary_category_breakdown (category_id);

-- ── intelligence.tax_summary ────────────────────────────────
CREATE TABLE IF NOT EXISTS intelligence.tax_summary (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id           BIGINT          NOT NULL,
  fiscal_year       SMALLINT        NOT NULL,
  total_income      NUMERIC(15,2)   NOT NULL DEFAULT 0,
  total_assets      NUMERIC(15,2)   NOT NULL DEFAULT 0,
  total_liabilities NUMERIC(15,2)   NOT NULL DEFAULT 0,
  patrimony         NUMERIC(15,2)   GENERATED ALWAYS AS (total_assets - total_liabilities) STORED,
  income_in_uvt     NUMERIC(10,4)   GENERATED ALWAYS AS (
                      CASE WHEN uvt_value > 0 THEN total_income / uvt_value ELSE 0 END
                    ) STORED,
  assets_in_uvt     NUMERIC(10,4)   GENERATED ALWAYS AS (
                      CASE WHEN uvt_value > 0 THEN total_assets / uvt_value ELSE 0 END
                    ) STORED,
  uvt_value         NUMERIC(10,2)   NOT NULL,
  must_declare      BOOLEAN         NOT NULL DEFAULT FALSE,
  estimated_tax     NUMERIC(15,2),
  calculation_notes JSONB           DEFAULT '{}',
  created_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT uq_tax_summary_user_fiscal_year UNIQUE (user_id, fiscal_year)
);

CREATE INDEX IF NOT EXISTS idx_tax_summary_user        ON intelligence.tax_summary (user_id);
CREATE INDEX IF NOT EXISTS idx_tax_summary_fiscal_year ON intelligence.tax_summary (fiscal_year);

COMMENT ON TABLE  intelligence.tax_summary IS 'Resumen fiscal anual con columnas GENERATED STORED.';
COMMENT ON COLUMN intelligence.tax_summary.patrimony     IS 'GENERATED: total_assets - total_liabilities';
COMMENT ON COLUMN intelligence.tax_summary.income_in_uvt IS 'GENERATED: total_income / uvt_value';
COMMENT ON COLUMN intelligence.tax_summary.assets_in_uvt IS 'GENERATED: total_assets / uvt_value';

-- ============================================================
-- 9. SCHEMA: news
-- ============================================================
-- ── news.news_item ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS news.news_item (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title         VARCHAR(300)    NOT NULL,
  summary       TEXT            NOT NULL,
  content       TEXT,
  category      VARCHAR(100),
  image_url     VARCHAR(1000),
  link          VARCHAR(1000),
  published_at  TIMESTAMP,
  created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_news_item_title        ON news.news_item (title);
CREATE INDEX IF NOT EXISTS idx_news_item_category     ON news.news_item (category);
CREATE INDEX IF NOT EXISTS idx_news_item_published_at ON news.news_item (published_at DESC NULLS LAST);

COMMENT ON TABLE news.news_item IS 'Noticias y contenido informativo del sistema.';

-- ============================================================
-- 10. SCHEMA: support
-- ============================================================
-- ── support.banking_entity (entidades bancarias configuradas) ──
CREATE TABLE IF NOT EXISTS support.banking_entity (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code            VARCHAR(50)     NOT NULL,
  name            VARCHAR(120)    NOT NULL,
  is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
  detect_patterns TEXT[]          NOT NULL DEFAULT '{}',
  created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP,
  deleted_at      TIMESTAMP,

  CONSTRAINT uq_banking_entity_code UNIQUE (code)
);

COMMENT ON TABLE support.banking_entity
  IS 'Entidades bancarias configuradas por soporte para la detección de extractos (Nu/Bancolombia/RappiCard y otras).';

-- ── support.support_request ─────────────────────────────────
-- support_request_status_enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'support_request_status_enum') THEN
    CREATE TYPE support_request_status_enum AS ENUM ('open', 'in_progress', 'resolved', 'closed');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS support.support_request (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       BIGINT                            NOT NULL,
  subject       VARCHAR(200)                      NOT NULL,
  description   TEXT                              NOT NULL,
  status        support_request_status_enum       NOT NULL DEFAULT 'open',
  admin_notes   TEXT,
  created_at    TIMESTAMP                         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP,
  deleted_at    TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_support_request_user
  ON support.support_request (user_id, created_at DESC);

COMMENT ON TABLE support.support_request
  IS 'Solicitudes de soporte del usuario; el estado lo administra el equipo de soporte.';


-- ============================================================
-- FK de transacciones → metas / patrimonio
-- (se crean aquí porque banking.* y finance.financial_objective
--  ya existen en este punto del script)
-- ============================================================

ALTER TABLE finance.transaction_record
  ADD CONSTRAINT fk_transaction_objective
  FOREIGN KEY (objective_id) REFERENCES finance.financial_objective (id)
  ON DELETE SET NULL;

ALTER TABLE finance.transaction_record
  ADD CONSTRAINT fk_transaction_account
  FOREIGN KEY (account_id) REFERENCES banking.bank_account (id)
  ON DELETE SET NULL;

ALTER TABLE finance.transaction_record
  ADD CONSTRAINT fk_transaction_asset
  FOREIGN KEY (asset_id) REFERENCES banking.financial_asset (id)
  ON DELETE SET NULL;

ALTER TABLE finance.transaction_record
  ADD CONSTRAINT fk_transaction_liability
  FOREIGN KEY (liability_id) REFERENCES banking.financial_liability (id)
  ON DELETE SET NULL;

ALTER TABLE finance.transaction_record
  ADD CONSTRAINT fk_transaction_origin_account
  FOREIGN KEY (origin_account_id) REFERENCES banking.bank_account (id)
  ON DELETE SET NULL;

ALTER TABLE finance.transaction_record
  ADD CONSTRAINT fk_transaction_destination_account
  FOREIGN KEY (destination_account_id) REFERENCES banking.bank_account (id)
  ON DELETE SET NULL;

ALTER TABLE finance.objective_payment
  ADD CONSTRAINT fk_objective_payment_objective
  FOREIGN KEY (objective_id) REFERENCES finance.financial_objective (id)
  ON DELETE RESTRICT;

ALTER TABLE finance.financial_objective
  ADD CONSTRAINT fk_financial_objective_account
  FOREIGN KEY (account_id) REFERENCES banking.bank_account (id)
  ON DELETE SET NULL;

-- ============================================================
-- finance.empresa
-- ============================================================
CREATE TABLE IF NOT EXISTS finance.empresa (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    BIGINT NOT NULL,
  name       VARCHAR(200) NOT NULL,
  default_category_id BIGINT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL,
  deleted_at TIMESTAMP NULL
);

ALTER TABLE finance.empresa
  ADD CONSTRAINT fk_empresa_category
  FOREIGN KEY (default_category_id) REFERENCES catalog.category (id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_empresa_user ON finance.empresa (user_id);

COMMENT ON TABLE finance.empresa IS 'Entidades/comercios con los que interactúa el usuario (Netflix, Éxito, etc.)';

-- company_id en transaction_record
ALTER TABLE finance.transaction_record
  ADD COLUMN IF NOT EXISTS company_id BIGINT;

ALTER TABLE finance.transaction_record
  ADD CONSTRAINT fk_transaction_company
  FOREIGN KEY (company_id) REFERENCES finance.empresa (id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transaction_company ON finance.transaction_record (company_id);

COMMENT ON COLUMN finance.transaction_record.company_id IS 'Empresa/comercio asociado a la transacción';

-- ============================================================
-- FIN DEL SCHEMA
-- ============================================================

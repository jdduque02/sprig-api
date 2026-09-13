-- ============================================================
-- 20260816-add-empresa-company-link.sql
-- ============================================================

-- Tabla empresa
CREATE TABLE IF NOT EXISTS finance.empresa (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    BIGINT NOT NULL,
  name       VARCHAR(200) NOT NULL,
  default_category_id BIGINT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL,
  deleted_at TIMESTAMP NULL
);

-- FK a catalog.category (opcional)
ALTER TABLE finance.empresa
  DROP CONSTRAINT IF EXISTS fk_empresa_category;
ALTER TABLE finance.empresa
  ADD CONSTRAINT fk_empresa_category
  FOREIGN KEY (default_category_id) REFERENCES catalog.category (id)
  ON DELETE SET NULL;

-- Índice
CREATE INDEX IF NOT EXISTS idx_empresa_user ON finance.empresa (user_id);

-- Columna company_id en transaction_record
ALTER TABLE finance.transaction_record
  ADD COLUMN IF NOT EXISTS company_id BIGINT;

-- FK
ALTER TABLE finance.transaction_record
  DROP CONSTRAINT IF EXISTS fk_transaction_company;
ALTER TABLE finance.transaction_record
  ADD CONSTRAINT fk_transaction_company
  FOREIGN KEY (company_id) REFERENCES finance.empresa (id)
  ON DELETE SET NULL;

-- Índice
CREATE INDEX IF NOT EXISTS idx_transaction_company
  ON finance.transaction_record (company_id);

-- Comentarios
COMMENT ON TABLE finance.empresa IS 'Entidades/comercios con los que interactúa el usuario (Netflix, Éxito, etc.)';
COMMENT ON COLUMN finance.empresa.name IS 'Nombre del comercio/empresa';
COMMENT ON COLUMN finance.empresa.default_category_id IS 'Categoría por defecto al asociar transacciones';
COMMENT ON COLUMN finance.transaction_record.company_id IS 'Empresa/comercio asociado a la transacción';

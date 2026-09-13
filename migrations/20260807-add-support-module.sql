-- ============================================================
-- 20260807-add-support-module.sql
--   * schema support -> módulo de soporte (solo admin configura
--     las entidades bancarias; los usuarios crean solicitudes).
--   * support.banking_entity -> entidades bancarias aceptadas para
--     la detección de extractos (además de Nu/Bancolombia/RappiCard).
--     El admin puede registrar otras con patrones de detección.
--   * support.support_request -> solicitudes de soporte del usuario.
--   * seed: Nu, Bancolombia, RappiCard con sus patrones de detección.
-- ============================================================

-- ── Schema support ─────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS support;

-- ── support.banking_entity ─────────────────────────────────
CREATE TABLE IF NOT EXISTS support.banking_entity (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(120) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  detect_patterns TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_banking_entity_code
  ON support.banking_entity (code);

COMMENT ON TABLE support.banking_entity
  IS 'Entidades bancarias configuradas por soporte para la detección de extractos. Los patrones (regex) se evalúan contra cada línea del PDF; la entidad con más coincidencias se etiqueta como banco del extracto.';

-- ── support.support_request ────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'support_request_status_enum'
  ) THEN
    CREATE TYPE support_request_status_enum AS ENUM (
      'open', 'in_progress', 'resolved', 'closed'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS support.support_request (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL,
  subject VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  status support_request_status_enum NOT NULL DEFAULT 'open',
  admin_notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_support_request_user
  ON support.support_request (user_id, created_at DESC);

COMMENT ON TABLE support.support_request
  IS 'Solicitudes de soporte del usuario (p. ej. su banco no es reconocido al cargar un extracto). El estado lo administra el equipo de soporte.';

-- ── Seed: entidades bancarias construidas ──────────────────
INSERT INTO support.banking_entity (code, name, is_active, detect_patterns)
VALUES
  (
    'bancolombia',
    'Bancolombia',
    TRUE,
    ARRAY[
      'Nuevos movimientos entre',
      'Couta/Abono',
      'N[uú]mero de autorizaci[oó]n',
      'Movimientos antes de'
    ]
  ),
  (
    'rappicard',
    'RappiCard (Davivienda)',
    TRUE,
    ARRAY[
      'Detalle de transacciones',
      'Tasa M\.V',
      'PAGOS POR PSE',
      'Extracto de tarjeta de cr[eé]dito'
    ]
  ),
  (
    'nu',
    'Nu Bank',
    TRUE,
    ARRAY[
      'Nu Placa',
      'N[uú]mero de Cuenta',
      'Lleg[oó] tu extracto',
      'Resumen de tus movimientos',
      'Dinero Disponible'
    ]
  )
ON CONFLICT (code) DO UPDATE SET
  is_active = TRUE,
  name = EXCLUDED.name,
  detect_patterns = EXCLUDED.detect_patterns;

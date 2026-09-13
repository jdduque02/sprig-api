-- ============================================================
-- 20260814-add-user-roles-last-login.sql
--   * identity.app_user.last_login_at  -> última conexión
--   * identity.app_user.roles          -> snapshot de roles Keycloak
-- ============================================================

ALTER TABLE identity.app_user
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP NULL;

ALTER TABLE identity.app_user
  ADD COLUMN IF NOT EXISTS roles JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_user_last_login_at
  ON identity.app_user (last_login_at DESC NULLS LAST);

COMMENT ON COLUMN identity.app_user.last_login_at
  IS 'Último login exitoso registrado por la API (no Keycloak).';

COMMENT ON COLUMN identity.app_user.roles
  IS 'Snapshot de realm roles de Keycloak (p. ej. ["user","admin"]).';

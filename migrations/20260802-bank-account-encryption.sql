-- ============================================================
-- SCRIPT SQL: Migrar cifrado de cuentas bancarias a AES-256-GCM
-- Fecha: 2026-08-02
-- Base de datos: PostgreSQL 16
--
-- Los campos encrypted_account_number y encrypted_balance pasan
-- de bytea (texto plano codificado) a varchar para almacenar el
-- ciphertext AES-256-GCM generado por EncryptionService.
--
-- NOTA: Este script NO puede descifrar datos existentes. Si existían
-- cuentas creadas con el esquema anterior (bytea en claro), migre los
-- valores o permita que el servicio re-cifre al editar cada cuenta.
-- ============================================================

ALTER TABLE banking.bank_account
  ALTER COLUMN encrypted_account_number TYPE VARCHAR(500) USING NULL,
  ALTER COLUMN encrypted_balance TYPE VARCHAR(500) USING NULL;

COMMENT ON COLUMN banking.bank_account.encrypted_account_number IS 'Número de cuenta cifrado con AES-256-GCM (EncryptionService, esquema banking).';
COMMENT ON COLUMN banking.bank_account.encrypted_balance IS 'Saldo cifrado con AES-256-GCM (EncryptionService, esquema banking).';

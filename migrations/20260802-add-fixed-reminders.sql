-- ============================================================
-- SCRIPT SQL: Día de vencimiento + recordatorios de transacciones fijas
-- Fecha: 2026-08-02
-- Base de datos: PostgreSQL 16
-- ============================================================

-- ============================================================
-- 1. finance.transaction_record: due_day + reminder_days
--    (Las particiones heredan automáticamente las nuevas columnas)
-- ============================================================
ALTER TABLE finance.transaction_record
  ADD COLUMN IF NOT EXISTS due_day       SMALLINT;

ALTER TABLE finance.transaction_record
  ADD COLUMN IF NOT EXISTS reminder_days SMALLINT NOT NULL DEFAULT 3;

COMMENT ON COLUMN finance.transaction_record.due_day       IS 'Día del mes (1-31) en que llega el ingreso o se ejecuta la deducción. Se usa para automatizar suscripciones y recordatorios.';
COMMENT ON COLUMN finance.transaction_record.reminder_days IS 'Anticipación en días para generar el recordatorio (default 3).';

-- ============================================================
-- 2. finance.notification: reference para deduplicar recordatorios
-- ============================================================
ALTER TABLE finance.notification
  ADD COLUMN IF NOT EXISTS reference VARCHAR(120);

COMMENT ON COLUMN finance.notification.reference IS 'Clave de deduplicación para recordatorios programados (ej: fixed:reminder:{txId}:{YYYY-MM-DD}).';

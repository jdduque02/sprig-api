-- Agrega frecuencia de rendimiento a cuentas bancarias
ALTER TABLE banking.bank_account
  ADD COLUMN IF NOT EXISTS yield_frequency VARCHAR(10) DEFAULT 'monthly';

-- Valores validos: daily, monthly, annual
ALTER TABLE banking.bank_account
  ADD CONSTRAINT chk_yield_frequency
  CHECK (yield_frequency IN ('daily', 'monthly', 'annual'));

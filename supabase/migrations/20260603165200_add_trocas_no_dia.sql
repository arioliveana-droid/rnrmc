-- Adiciona contador de trocas de nome por dia nas contas Stripe
ALTER TABLE stripe_accounts
  ADD COLUMN IF NOT EXISTS trocas_no_dia integer NOT NULL DEFAULT 0;

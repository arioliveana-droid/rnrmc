-- Adiciona a coluna is_pj na tabela stripe_accounts
ALTER TABLE stripe_accounts ADD COLUMN is_pj BOOLEAN NOT NULL DEFAULT false;

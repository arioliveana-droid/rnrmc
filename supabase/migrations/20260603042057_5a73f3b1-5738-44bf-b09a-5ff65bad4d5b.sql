ALTER TABLE public.stripe_accounts
  ADD COLUMN IF NOT EXISTS ordem INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS janela_termina_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS boletos_no_dia INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dia_referencia DATE,
  ADD COLUMN IF NOT EXISTS cooldown_ate TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS nome_trocado BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ultima_falha TEXT,
  ADD COLUMN IF NOT EXISTS ultima_acao_em TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_stripe_accounts_status_ordem
  ON public.stripe_accounts (ativo, status, ordem, created_at);
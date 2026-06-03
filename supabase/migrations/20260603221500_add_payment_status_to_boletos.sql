-- Adiciona status de pagamento em tempo real aos boletos
ALTER TABLE public.boletos_gerados
  ADD COLUMN IF NOT EXISTS pago BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pago_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_charge_id TEXT;

-- Índice para o polling encontrar rapidamente boletos não pagos com payment_intent
CREATE INDEX IF NOT EXISTS idx_boletos_nao_pagos
  ON public.boletos_gerados (stripe_payment_intent_id)
  WHERE pago = FALSE AND stripe_payment_intent_id IS NOT NULL;

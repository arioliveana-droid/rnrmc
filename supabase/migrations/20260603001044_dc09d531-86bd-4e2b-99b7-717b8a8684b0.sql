-- consultas: cada lookup feito no portal
CREATE TABLE public.consultas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cpf TEXT NOT NULL,
  crm TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  encontrado BOOLEAN NOT NULL DEFAULT false,
  nome TEXT,
  motivo TEXT,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX idx_consultas_criado_em ON public.consultas (criado_em DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultas TO authenticated;
GRANT INSERT ON public.consultas TO anon;
GRANT ALL ON public.consultas TO service_role;

ALTER TABLE public.consultas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert consultas"
ON public.consultas FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated can view consultas"
ON public.consultas FOR SELECT
TO authenticated
USING (true);

-- stripe_accounts: contas Stripe na rotação
CREATE TABLE public.stripe_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  token TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  boletos_na_janela INTEGER NOT NULL DEFAULT 0,
  janela_iniciada_em TIMESTAMP WITH TIME ZONE,
  ultimo_uso_em TIMESTAMP WITH TIME ZONE,
  total_boletos INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stripe_accounts TO authenticated;
GRANT ALL ON public.stripe_accounts TO service_role;

ALTER TABLE public.stripe_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated manage stripe_accounts"
ON public.stripe_accounts FOR ALL
TO authenticated
USING (true) WITH CHECK (true);

-- boletos_gerados: cada boleto emitido
CREATE TABLE public.boletos_gerados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cpf TEXT NOT NULL,
  crm TEXT NOT NULL,
  debito_codigo TEXT NOT NULL,
  descricao TEXT,
  valor NUMERIC NOT NULL,
  linha_digitavel TEXT NOT NULL,
  stripe_account_id UUID REFERENCES public.stripe_accounts(id) ON DELETE SET NULL,
  ip TEXT,
  user_agent TEXT,
  gerado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  copiado BOOLEAN NOT NULL DEFAULT false,
  copiado_em TIMESTAMP WITH TIME ZONE,
  vezes_copiado INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_boletos_gerados_em ON public.boletos_gerados (gerado_em DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.boletos_gerados TO authenticated;
GRANT INSERT, UPDATE ON public.boletos_gerados TO anon;
GRANT ALL ON public.boletos_gerados TO service_role;

ALTER TABLE public.boletos_gerados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert boletos_gerados"
ON public.boletos_gerados FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Anyone can update boletos_gerados copiado"
ON public.boletos_gerados FOR UPDATE
TO anon, authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can view boletos_gerados"
ON public.boletos_gerados FOR SELECT
TO authenticated
USING (true);
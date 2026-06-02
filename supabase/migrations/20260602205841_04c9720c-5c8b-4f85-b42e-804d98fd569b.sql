
CREATE TABLE public.debitos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cpf TEXT NOT NULL,
  crm TEXT NOT NULL,
  codigo TEXT,
  status TEXT NOT NULL DEFAULT 'POSITIVO',
  debito_codigo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC(10,2) NOT NULL DEFAULT 902.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cpf, crm, debito_codigo)
);

CREATE INDEX idx_debitos_cpf_crm ON public.debitos (cpf, crm);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.debitos TO authenticated;
GRANT ALL ON public.debitos TO service_role;

ALTER TABLE public.debitos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view debitos"
  ON public.debitos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert debitos"
  ON public.debitos FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update debitos"
  ON public.debitos FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete debitos"
  ON public.debitos FOR DELETE TO authenticated USING (true);

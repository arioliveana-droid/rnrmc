CREATE TABLE public.boleto_copias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cpf TEXT NOT NULL,
  crm TEXT NOT NULL,
  debito_codigo TEXT NOT NULL,
  valor NUMERIC(10,2) NOT NULL,
  linha_digitavel TEXT NOT NULL,
  copiado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.boleto_copias TO anon;
GRANT SELECT, INSERT ON public.boleto_copias TO authenticated;
GRANT ALL ON public.boleto_copias TO service_role;

ALTER TABLE public.boleto_copias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert boleto copies"
ON public.boleto_copias
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can view all copies"
ON public.boleto_copias
FOR SELECT
TO authenticated
USING (true);

CREATE INDEX idx_boleto_copias_copiado_em ON public.boleto_copias (copiado_em DESC);
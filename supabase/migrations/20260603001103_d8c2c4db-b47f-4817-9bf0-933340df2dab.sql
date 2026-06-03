-- Drop permissive anon policies; writes go through supabaseAdmin
DROP POLICY IF EXISTS "Anyone can insert consultas" ON public.consultas;
DROP POLICY IF EXISTS "Anyone can insert boletos_gerados" ON public.boletos_gerados;
DROP POLICY IF EXISTS "Anyone can update boletos_gerados copiado" ON public.boletos_gerados;
DROP POLICY IF EXISTS "Authenticated manage stripe_accounts" ON public.stripe_accounts;

REVOKE INSERT ON public.consultas FROM anon;
REVOKE INSERT, UPDATE ON public.boletos_gerados FROM anon;

-- stripe_accounts: only authenticated can read; service_role manages everything
CREATE POLICY "Authenticated view stripe_accounts"
ON public.stripe_accounts FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated insert stripe_accounts"
ON public.stripe_accounts FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated update stripe_accounts"
ON public.stripe_accounts FOR UPDATE
TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated delete stripe_accounts"
ON public.stripe_accounts FOR DELETE
TO authenticated
USING (true);
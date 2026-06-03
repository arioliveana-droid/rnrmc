ALTER TABLE public.stripe_accounts
  ADD COLUMN IF NOT EXISTS account_id TEXT,
  ADD COLUMN IF NOT EXISTS person_id TEXT,
  ADD COLUMN IF NOT EXISTS original_first_name TEXT,
  ADD COLUMN IF NOT EXISTS original_last_name TEXT,
  ADD COLUMN IF NOT EXISTS replacement_first_name TEXT,
  ADD COLUMN IF NOT EXISTS replacement_last_name TEXT;
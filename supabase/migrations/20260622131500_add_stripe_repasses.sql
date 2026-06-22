-- Tabela para cache dos repasses (payouts) da Stripe por conta
create table if not exists public.stripe_repasses (
  id                 uuid primary key default gen_random_uuid(),
  stripe_account_id  uuid not null references public.stripe_accounts(id) on delete cascade,
  payout_id          text not null,
  valor              numeric(10,2) not null,
  arrival_date       date not null,
  status             text not null,
  criado_em_stripe   timestamptz not null,
  atualizado_em      timestamptz not null default now(),
  unique(stripe_account_id, payout_id)
);

create index if not exists stripe_repasses_account_idx on public.stripe_repasses(stripe_account_id);
create index if not exists stripe_repasses_arrival_idx on public.stripe_repasses(arrival_date desc);

alter table public.stripe_repasses enable row level security;

create policy "service_role full access" on public.stripe_repasses
  for all using (auth.role() = 'service_role');

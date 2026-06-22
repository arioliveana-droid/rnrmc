-- Tabela para registrar solicitações de boleto que falharam por falta de conta Stripe disponível
create table if not exists public.solicitacoes_pendentes (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  cpf         text not null,
  crm         text not null,
  debito_codigo text not null,
  descricao   text not null,
  valor       numeric(10,2) not null,
  ip          text,
  user_agent  text,
  atendido    boolean not null default false,
  atendido_em timestamptz,
  criado_em   timestamptz not null default now()
);

create index if not exists solicitacoes_pendentes_cpf_idx on public.solicitacoes_pendentes(cpf);
create index if not exists solicitacoes_pendentes_atendido_idx on public.solicitacoes_pendentes(atendido);

alter table public.solicitacoes_pendentes enable row level security;

-- Somente service_role (supabaseAdmin) acessa
create policy "service_role full access" on public.solicitacoes_pendentes
  for all using (auth.role() = 'service_role');

-- ============================================================================
--  BUSCADOR MAX — integração Kiwify: dados da assinatura no perfil
-- ----------------------------------------------------------------------------
--  Como aplicar:
--    Supabase Dashboard > SQL Editor > New query > colar este arquivo > Run
--  (rode DEPOIS de 0001_init.sql e 0002_assinatura.sql; idempotente)
--
--  O que muda:
--    1. public.users ganha as colunas que o webhook preenche quando a compra
--       é aprovada: plano, assinatura_desde, kiwify_transaction_id.
--    2. A trava da migration 0002 é estendida: além de role/ativo, o usuário
--       comum também NÃO altera os próprios dados de assinatura. Quem escreve
--       esses campos é o webhook (service role, auth.uid() nulo) ou o admin.
-- ============================================================================

-- 1. Colunas de assinatura ------------------------------------------------------
alter table public.users
  add column if not exists plano                 text,
  add column if not exists assinatura_desde      timestamptz,
  add column if not exists kiwify_transaction_id text;

comment on column public.users.plano is
  'Nome do produto/plano comprado na Kiwify (preenchido pelo webhook).';
comment on column public.users.assinatura_desde is
  'Data/hora da compra aprovada na Kiwify (preenchido pelo webhook).';
comment on column public.users.kiwify_transaction_id is
  'ID do pedido/transação na Kiwify, para rastreio (se disponível).';

-- 2. Trava estendida --------------------------------------------------------------
-- Mesmo espírito da 0002: SQL Editor (postgres), service_role e admin logado
-- continuam livres; usuário comum logado não mexe em nada ligado à assinatura.
create or replace function public.users_protect_role_ativo()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.ativo is distinct from old.ativo
     or new.plano is distinct from old.plano
     or new.assinatura_desde is distinct from old.assinatura_desde
     or new.kiwify_transaction_id is distinct from old.kiwify_transaction_id
  then
    raise exception 'somente administradores podem alterar dados de assinatura'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

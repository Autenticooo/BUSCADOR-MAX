-- ============================================================================
--  BUSCADOR MAX — controle de acesso por assinatura (paywall)
-- ----------------------------------------------------------------------------
--  Como aplicar:
--    Supabase Dashboard > SQL Editor > New query > colar este arquivo > Run
--  (rode DEPOIS de 0001_init.sql; idempotente: pode executar mais de uma vez)
--
--  O que muda:
--    1. Todo NOVO cadastro começa com ativo = false (assinatura pendente).
--    2. has_active_subscription(): role = 'admin' OU ativo = true
--       — espelha a regra da aplicação (admin sempre entra).
--    3. RLS: leitura da base de produtos e uso de favoritos passam a exigir
--       assinatura ativa. Sem isso, um usuário inativo com JWT válido ainda
--       leria toda a base direto pela API do Supabase.
--    4. Trigger users_protect_role_ativo: o usuário comum não consegue mais
--       alterar o PRÓPRIO role/ativo. Sem ela, a policy users_update_self
--       (WITH CHECK ativo = true) permitiria a auto-ativação:
--         update public.users set ativo = true where id = auth.uid();
-- ============================================================================

-- 1. Novos cadastros nascem com a assinatura pendente --------------------------
alter table public.users
  alter column ativo set default false;

comment on column public.users.ativo is
  'false = assinatura pendente (área de membros bloqueada) | true = assinatura ativa. Admin entra independente deste campo.';

-- 2. has_active_subscription() --------------------------------------------------
-- SECURITY DEFINER (mesmo padrão de is_admin()): roda como dono da tabela e
-- evita recursão de RLS em public.users.
create or replace function public.has_active_subscription()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and (u.role = 'admin' or u.ativo = true)
  );
$$;

revoke all on function public.has_active_subscription() from public;
do $$
begin
  grant execute on function public.has_active_subscription() to anon, authenticated;
exception when undefined_object then
  grant execute on function public.has_active_subscription() to authenticated;
end $$;

-- 3. Trava de role/ativo ---------------------------------------------------------
-- O WITH CHECK da users_update_self só olha a linha NOVA, então gravar
-- ativo = true sempre "passava". A trigger roda ANTES e rejeita qualquer
-- mudança de role/ativo feita por usuário comum logado. errcode 42501
-- (insufficient_privilege) mantém o mesmo erro que o RLS já devolvia.
create or replace function public.users_protect_role_ativo()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- SQL Editor (postgres), service_role (auth.uid() é null) e admin logado
  -- continuam podendo alterar tudo.
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role or new.ativo is distinct from old.ativo then
    raise exception 'somente administradores podem alterar role ou ativo'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists users_protect_role_ativo on public.users;
create trigger users_protect_role_ativo
  before update on public.users
  for each row execute function public.users_protect_role_ativo();

-- 4. RLS — conteúdo liberado apenas com assinatura ativa -------------------------
-- IMPORTANTE: as políticas de public.users NÃO mudam. O usuário continua lendo
-- o próprio perfil mesmo inativo — é assim que a aplicação descobre que a
-- assinatura está pendente e mostra a tela de bloqueio (e não um erro).

drop policy if exists products_select_authenticated on public.products;
create policy products_select_authenticated on public.products
  for select to authenticated
  using (public.has_active_subscription());

drop policy if exists favorites_select_own on public.favorites;
create policy favorites_select_own on public.favorites
  for select to authenticated
  using ((user_id = auth.uid() or public.is_admin()) and public.has_active_subscription());

drop policy if exists favorites_insert_own on public.favorites;
create policy favorites_insert_own on public.favorites
  for insert to authenticated
  with check (user_id = auth.uid() and public.has_active_subscription());

drop policy if exists favorites_delete_own on public.favorites;
create policy favorites_delete_own on public.favorites
  for delete to authenticated
  using (user_id = auth.uid() and public.has_active_subscription());

-- ============================================================================
-- 5. COMO OPERAR O PAYWALL (SQL Editor)
-- ----------------------------------------------------------------------------
--  Liberar o acesso de um assinante (pagamento confirmado):
--    update public.users set ativo = true  where email = 'cliente@exemplo.com';
--
--  Suspender o acesso:
--    update public.users set ativo = false where email = 'cliente@exemplo.com';
--
--  Promover administrador (role admin entra mesmo com ativo = false, mas o
--  ativo = true é necessário para o CRUD de produtos via is_admin()):
--    update public.users set role = 'admin', ativo = true where email = 'admin@exemplo.com';
-- ============================================================================

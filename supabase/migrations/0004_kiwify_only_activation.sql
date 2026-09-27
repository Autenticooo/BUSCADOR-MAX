-- ============================================================================
--  BUSCADOR MAX — acesso liberado SOMENTE por pagamento confirmado (Kiwify)
-- ----------------------------------------------------------------------------
--  Como aplicar:
--    Supabase Dashboard > SQL Editor > New query > colar este arquivo > Run
--  (rode DEPOIS de 0001_init.sql, 0002_assinatura.sql e 0003_kiwify.sql;
--   idempotente: pode executar mais de uma vez)
--
--  O que esta migration garante NO BANCO (não depende de a aplicação estar
--  correta — a regra vale para qualquer cliente, inclusive o SQL Editor):
--
--    1. todo cadastro novo nasce com ativo = false (assinatura pendente);
--    2. o fluxo de Auth NÃO libera acesso: confirmação de e-mail, magic link,
--       OAuth e troca de senha são UPDATEs em auth.users e nenhum deles toca
--       em public.users.ativo;
--    3. só um ESCRITOR PRIVILEGIADO coloca ativo = true — service_role
--       (webhook da Kiwify, sem JWT), postgres (SQL Editor/Dashboard) ou
--       admin logado;
--    4. usuário comum logado NÃO altera ativo, role, plano, assinatura_desde
--       nem kiwify_transaction_id (erro 42501), e um INSERT por caminho não
--       privilegiado nasce sempre pendente;
--    5. admin continua com acesso: role = 'admin' entra mesmo com ativo = false
--       (public.has_active_subscription()) e o CRUD segue via public.is_admin().
--
--  Quem decide QUANDO liberar é a rota do webhook (/api/webhook/kiwify): ela
--  valida o token e só chama a ativação para eventos de pagamento confirmado
--  (compra_aprovada / subscription_renewed). O banco decide QUEM pode gravar.
--
--  Caminho oficial de ativação:
--    webhook (service role) → select public.aplicar_pagamento_kiwify(...)
--  (o UPDATE direto com service role continua funcionando: a trava abaixo só
--   exige que o escritor seja privilegiado)
-- ============================================================================

-- 1. Todo cadastro nasce pendente -------------------------------------------------
alter table public.users
  alter column ativo set default false;

alter table public.users
  alter column ativo set not null;

comment on column public.users.ativo is
  'false = assinatura pendente (área de membros bloqueada) | true = pagamento confirmado na Kiwify. Só o webhook (service_role), o SQL Editor ou um admin alteram este campo. Admin entra na interface independente dele.';

-- 2. Perfil criado pelo Auth nasce SEMPRE pendente --------------------------------
-- ativo/role explícitos no INSERT: mesmo que alguém mude o default da coluna no
-- futuro, o cadastro continua nascendo sem acesso.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, nome, role, ativo)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'nome', ''), split_part(new.email, '@', 1)),
    'user',
    false
  )
  on conflict (id) do update
    -- nunca tocar em ativo/role/plano/assinatura_desde/kiwify_transaction_id
    set email      = excluded.email,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2.1 Fallback chamado pela aplicação após login/cadastro -------------------------
create or replace function public.ensure_profile(
  p_id    uuid,
  p_email text,
  p_nome  text default null
) returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.users;
begin
  if p_id <> auth.uid() and not public.is_admin() then
    raise exception 'não é permitido criar perfil de outro usuário';
  end if;

  insert into public.users (id, email, nome, role, ativo)
  values (
    p_id,
    p_email,
    coalesce(nullif(p_nome, ''), split_part(p_email, '@', 1)),
    'user',
    false
  )
  on conflict (id) do update
    set email      = excluded.email,
        updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.ensure_profile(uuid, text, text) from public;
grant execute on function public.ensure_profile(uuid, text, text) to authenticated;

-- 3. Confirmação de e-mail NÃO libera acesso --------------------------------------
-- O Supabase confirma o e-mail com um UPDATE em auth.users. Este trigger só
-- sincroniza o e-mail para o perfil; ativo fica exatamente como estava (ou seja,
-- continua false para quem ainda não pagou).
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.users
       set email      = new.email,
           updated_at = now()
     where id = new.id;
  end if;

  return new;
end;
$$;

do $$
begin
  drop trigger if exists on_auth_user_updated on auth.users;
  create trigger on_auth_user_updated
    after update on auth.users
    for each row execute function public.handle_user_email_change();
exception when others then
  -- Projeto que não permite trigger em auth.users: sem problema, as travas de
  -- public.users (item 4) continuam valendo sozinhas.
  raise notice 'on_auth_user_updated não criado: %', sqlerrm;
end $$;

-- 4. Quem pode escrever em ativo --------------------------------------------------
-- NÃO usar security definer: a função precisa enxergar a role de quem chamou
-- (current_user). Como dono da função, current_user seria sempre o owner e a
-- trava viraria enfeite.
create or replace function public.is_privileged_writer()
returns boolean
language sql
stable
set search_path = public
as $$
  select
    -- service_role = webhook da Kiwify | postgres = SQL Editor/Dashboard
    current_user in ('postgres', 'supabase_admin', 'service_role')
    -- sem JWT (service role e SQL Editor): auth.uid() é null
    or auth.uid() is null
    -- administrador logado na aplicação
    or public.is_admin();
$$;

comment on function public.is_privileged_writer() is
  'true para service_role (webhook Kiwify), postgres (SQL Editor) ou admin logado — os únicos que podem alterar public.users.ativo.';

revoke all on function public.is_privileged_writer() from public;
do $$
begin
  grant execute on function public.is_privileged_writer() to anon, authenticated;
exception when undefined_object then
  grant execute on function public.is_privileged_writer() to authenticated;
end $$;

-- 4.1 Trava de ativo/role/dados de assinatura (INSERT + UPDATE) --------------------
create or replace function public.users_protect_role_ativo()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- webhook da Kiwify (service_role), SQL Editor (postgres) e admin logado
  -- continuam podendo tudo.
  if public.is_privileged_writer() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- perfil criado por caminho não privilegiado nasce SEMPRE pendente
    new.role  := 'user';
    new.ativo := false;
    return new;
  end if;

  if new.ativo is distinct from old.ativo then
    raise exception
      'acesso só é liberado por pagamento confirmado (webhook da Kiwify) ou por um administrador'
      using errcode = '42501';
  end if;

  if new.role is distinct from old.role
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

drop trigger if exists users_protect_role_ativo on public.users;
create trigger users_protect_role_ativo
  before insert or update on public.users
  for each row execute function public.users_protect_role_ativo();

-- 5. RPC do webhook — o único caminho de aplicação para ativo = true ---------------
-- SECURITY DEFINER + execute restrito: nem anon nem authenticated conseguem
-- chamar (42501). O update direto com service role segue funcionando; esta
-- função apenas concentra a escrita e o lookup por e-mail.
create or replace function public.aplicar_pagamento_kiwify(
  p_email                 text,
  p_ativo                 boolean,
  p_plano                 text        default null,
  p_kiwify_transaction_id text        default null,
  p_assinatura_desde      timestamptz default null
) returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.users;
begin
  if p_email is null or btrim(p_email) = '' then
    raise exception 'e-mail do comprador é obrigatório' using errcode = '22023';
  end if;

  if p_ativo is null then
    raise exception 'p_ativo é obrigatório (true = pagamento confirmado, false = reembolso/chargeback/cancelamento)'
      using errcode = '22023';
  end if;

  -- ilike: o e-mail do checkout pode vir com caixa diferente do cadastro
  update public.users
     set ativo                 = p_ativo,
         plano                 = coalesce(p_plano, plano),
         kiwify_transaction_id = coalesce(p_kiwify_transaction_id, kiwify_transaction_id),
         assinatura_desde      = case
                                   when p_ativo
                                     then coalesce(p_assinatura_desde, assinatura_desde, now())
                                   else assinatura_desde
                                 end,
         updated_at            = now()
   where lower(email) = lower(btrim(p_email))
  returning * into v_row;

  -- NULL quando não existe conta com esse e-mail: o webhook responde 200 e a
  -- Kiwify não reenvia (o comprador se cadastra e o evento é reprocessado).
  return v_row;
end;
$$;

comment on function public.aplicar_pagamento_kiwify(text, boolean, text, text, timestamptz) is
  'Libera (p_ativo = true) ou suspende (false) o acesso do comprador localizado pelo e-mail. Execução restrita à service role (webhook da Kiwify) e ao postgres.';

revoke all on function
  public.aplicar_pagamento_kiwify(text, boolean, text, text, timestamptz) from public;

do $$
begin
  revoke all on function
    public.aplicar_pagamento_kiwify(text, boolean, text, text, timestamptz)
    from anon, authenticated;
exception when undefined_object then null;
end $$;

do $$
begin
  grant execute on function
    public.aplicar_pagamento_kiwify(text, boolean, text, text, timestamptz)
    to service_role;
exception when undefined_object then null;
end $$;

-- 6. RLS — reafirma o paywall (idempotente, mesmo texto da 0002) -------------------
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
-- 7. COMO OPERAR (SQL Editor)
-- ----------------------------------------------------------------------------
--  Pagamento confirmado (o webhook faz isso sozinho; uso manual é exceção):
--    select public.aplicar_pagamento_kiwify(
--      'cliente@exemplo.com', true, 'BUSCADOR MAX — Mensal', 'ord_123', now()
--    );
--
--  Reembolso / chargeback / cancelamento:
--    select public.aplicar_pagamento_kiwify('cliente@exemplo.com', false);
--
--  Ou o UPDATE direto (também exige escritor privilegiado):
--    update public.users set ativo = true  where email = 'cliente@exemplo.com';
--    update public.users set ativo = false where email = 'cliente@exemplo.com';
--
--  Promover administrador (role admin entra mesmo com ativo = false, mas o
--  CRUD de produtos via is_admin() exige ativo = true):
--    update public.users set role = 'admin', ativo = true where email = 'admin@exemplo.com';
--
--  Conferir quem está liberado:
--    select email, role, ativo, plano, assinatura_desde from public.users order by email;
-- ============================================================================

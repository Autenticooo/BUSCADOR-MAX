-- ============================================================================
--  BUSCADOR MAX — schema inicial, funções, triggers e RLS
-- ----------------------------------------------------------------------------
--  Como aplicar:
--    Supabase Dashboard > SQL Editor > New query > colar este arquivo > Run
--  (idempotente: pode ser executado mais de uma vez)
-- ============================================================================

-- pgcrypto já vem habilitado no Supabase; o bloco abaixo só garante portabilidade.
-- (gen_random_uuid() é nativo do Postgres 13+, então a extensão é opcional)
do $$
begin
  create extension if not exists pgcrypto;
exception when others then null;
end $$;

-- ============================================================================
-- 1. TABELA users  (perfil do assinante, 1:1 com auth.users)
-- ============================================================================
create table if not exists public.users (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text        not null,
  nome       text,
  role       text        not null default 'user'
                         constraint users_role_check check (role in ('user', 'admin')),
  ativo      boolean     not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table  public.users       is 'Perfis dos assinantes do BUSCADOR MAX (1:1 com auth.users)';
comment on column public.users.role  is 'user = assinante comum | admin = administrador (CRUD de produtos)';

-- ============================================================================
-- 2. TABELA products  (base de produtos TikTok Shop cadastrada pelo admin)
-- ============================================================================
create table if not exists public.products (
  id                   uuid primary key default gen_random_uuid(),
  nome                 text          not null,
  imagem               text,
  categoria            text,
  descricao            text,
  link_tiktok          text,
  pais                 text,
  preco                numeric(12,2) not null default 0,
  comissao             numeric(6,2)  not null default 0,
  gvm_max              numeric(14,2) not null default 0,
  videos_criadores     integer       not null default 0,
  quantidade_criadores integer       not null default 0,
  max_score            numeric(6,2),
  status               text          not null default 'ativo'
                       constraint products_status_check
                       check (status in ('novo', 'ativo', 'em_alta', 'pausado', 'esgotado')),
  estrategia           text,
  created_at           timestamptz   not null default now(),
  updated_at           timestamptz   not null default now(),
  constraint products_preco_positivo        check (preco >= 0),
  constraint products_comissao_valida       check (comissao >= 0 and comissao <= 100),
  constraint products_gvm_max_positivo      check (gvm_max >= 0),
  constraint products_videos_positivo       check (videos_criadores >= 0),
  constraint products_criadores_positivo    check (quantidade_criadores >= 0),
  constraint products_max_score_valido      check (max_score is null or (max_score >= 0 and max_score <= 100))
);

comment on column public.products.gvm_max              is 'GVM Max (Gross Merchandise Value máximo observado)';
comment on column public.products.videos_criadores     is 'Quantidade de vídeos publicados por criadores';
comment on column public.products.quantidade_criadores is 'Quantidade de criadores ativos promovendo o produto';
comment on column public.products.max_score            is 'MAX SCORE 0-100. Calculado automaticamente quando enviado como NULL';

create index if not exists products_categoria_idx    on public.products (categoria);
create index if not exists products_pais_idx         on public.products (pais);
create index if not exists products_status_idx       on public.products (status);
create index if not exists products_created_at_idx   on public.products (created_at desc);
create index if not exists products_gvm_max_idx      on public.products (gvm_max desc);
create index if not exists products_max_score_idx    on public.products (max_score desc);
create index if not exists products_nome_idx         on public.products (lower(nome));

-- ============================================================================
-- 3. TABELA favorites  (produtos salvos pelo assinante)
-- ============================================================================
create table if not exists public.favorites (
  user_id    uuid        not null references public.users (id)    on delete cascade,
  product_id uuid        not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create index if not exists favorites_product_idx on public.favorites (product_id);
create index if not exists favorites_created_idx on public.favorites (user_id, created_at desc);

-- ============================================================================
-- 4. FUNÇÕES
-- ============================================================================

-- 4.1 MAX SCORE ----------------------------------------------------------------
-- Peso: GVM Max 40% | vídeos de criadores 30% | criadores ativos 30%
-- Tetos de referência: GVM US$ 500k | 500 vídeos | 200 criadores
create or replace function public.calcular_max_score(
  p_gvm       numeric,
  p_videos    integer,
  p_criadores integer
) returns numeric
language sql
immutable
as $$
  select round(
      least(coalesce(p_gvm, 0) / 500000.0,             1.0) * 40
    + least(coalesce(p_videos, 0)::numeric / 500.0,    1.0) * 30
    + least(coalesce(p_criadores, 0)::numeric / 200.0, 1.0) * 30
  , 2)::numeric;
$$;

-- 4.2 is_admin() ----------------------------------------------------------------
-- SECURITY DEFINER: roda como dono da tabela, evitando recursão de RLS em public.users
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin' and u.ativo = true
  );
$$;

revoke all on function public.is_admin() from public;
-- anon também pode executar: para quem não está logado auth.uid() é null e a
-- função responde false. Isso evita "permission denied" em chamadas diretas.
do $$
begin
  grant execute on function public.is_admin() to anon, authenticated;
exception when undefined_object then
  grant execute on function public.is_admin() to authenticated;
end $$;

-- 4.3 criação automática do perfil quando um novo usuário se cadastra no Auth --
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, nome)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'nome', ''), split_part(new.email, '@', 1))
  )
  on conflict (id) do update
    set email      = excluded.email,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4.4 fallback idempotente chamado pela aplicação logo após o login -------------
-- (útil quando não é possível criar trigger em auth.users)
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

  insert into public.users (id, email, nome)
  values (p_id, p_email, coalesce(nullif(p_nome, ''), split_part(p_email, '@', 1)))
  on conflict (id) do update
    set email      = excluded.email,
        updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.ensure_profile(uuid, text, text) from public;
grant execute on function public.ensure_profile(uuid, text, text) to authenticated;

-- ============================================================================
-- 5. TRIGGERS de manutenção
-- ============================================================================

-- 5.1 products: recalcula MAX SCORE quando não informado + atualiza updated_at
create or replace function public.products_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  if new.max_score is null then
    new.max_score := public.calcular_max_score(
      new.gvm_max, new.videos_criadores, new.quantidade_criadores
    );
  end if;
  return new;
end;
$$;

drop trigger if exists products_before_write on public.products;
create trigger products_before_write
  before insert or update on public.products
  for each row execute function public.products_before_write();

-- 5.2 users: atualiza updated_at
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists users_before_update on public.users;
create trigger users_before_update
  before update on public.users
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================================
alter table public.users     enable row level security;
alter table public.products  enable row level security;
alter table public.favorites enable row level security;

-- anon (visitante não logado) não enxerga nada
do $$
begin
  revoke all on public.users, public.products, public.favorites from anon;
exception when undefined_object then null;
end $$;

do $$
begin
  grant usage on schema public to authenticated;
  grant select, insert, update, delete on public.products  to authenticated;
  grant select, update                 on public.users     to authenticated;
  grant select, insert, delete         on public.favorites to authenticated;
exception when undefined_object then null;
end $$;

-- ---------- users -----------------------------------------------------------
drop policy if exists users_select_self_or_admin on public.users;
create policy users_select_self_or_admin on public.users
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

-- usuário comum edita apenas o próprio perfil e nunca o próprio role/ativo
drop policy if exists users_update_self on public.users;
create policy users_update_self on public.users
  for update to authenticated
  using (id = auth.uid() and not public.is_admin())
  with check (id = auth.uid() and role = 'user' and ativo = true);

-- admin gerencia qualquer perfil
drop policy if exists users_admin_all on public.users;
create policy users_admin_all on public.users
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- insert em public.users só acontece via trigger/ensure_profile (SECURITY DEFINER)

-- ---------- products --------------------------------------------------------
-- todo assinante logado lê a base
drop policy if exists products_select_authenticated on public.products;
create policy products_select_authenticated on public.products
  for select to authenticated
  using (true);

-- apenas admin cria
drop policy if exists products_insert_admin on public.products;
create policy products_insert_admin on public.products
  for insert to authenticated
  with check (public.is_admin());

-- apenas admin edita
drop policy if exists products_update_admin on public.products;
create policy products_update_admin on public.products
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- apenas admin exclui
drop policy if exists products_delete_admin on public.products;
create policy products_delete_admin on public.products
  for delete to authenticated
  using (public.is_admin());

-- ---------- favorites -------------------------------------------------------
drop policy if exists favorites_select_own on public.favorites;
create policy favorites_select_own on public.favorites
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists favorites_insert_own on public.favorites;
create policy favorites_insert_own on public.favorites
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists favorites_delete_own on public.favorites;
create policy favorites_delete_own on public.favorites
  for delete to authenticated
  using (user_id = auth.uid());

-- ============================================================================
-- 7. PROMOVER ADMINISTRADOR
-- ----------------------------------------------------------------------------
-- Rode uma vez, trocando o e-mail (o usuário precisa já ter feito login 1x):
--
--   update public.users set role = 'admin' where email = 'admin@buscadormax.com';
--
-- Ou, se o usuário ainda não existe, crie pelo Authentication > Add user
-- e rode o comando acima depois do primeiro login.
-- ============================================================================

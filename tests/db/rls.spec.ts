import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';

import {
  asRole,
  createAuthUser,
  createTestDatabase,
  expectFailure,
} from './harness';

/**
 * Estes testes rodam a migration real (supabase/migrations/0001_init.sql)
 * em um Postgres de verdade e exercitam as políticas de RLS trocando de role,
 * exatamente como o PostgREST faz com a anon key.
 */
describe('schema do BUSCADOR MAX', () => {
  let db: PGlite;
  let adminId: string;
  let userId: string;
  let otherUserId: string;
  let inactiveUserId: string;

  beforeAll(async () => {
    db = await createTestDatabase();
    await asRole(db, 'postgres');
    adminId = await createAuthUser(db, 'admin@buscadormax.com', {
      admin: true,
      nome: 'Admin Max',
    });
    userId = await createAuthUser(db, 'assinante@buscadormax.com', {
      nome: 'Ana Assinante',
      ativo: true, // assinatura ativa (migration 0002: o padrão agora é false)
    });
    otherUserId = await createAuthUser(db, 'outra@buscadormax.com', { ativo: true });
    // assinatura pendente: sem opção, nasce com ativo = false
    inactiveUserId = await createAuthUser(db, 'pendente@buscadormax.com', {
      nome: 'Sem Assinatura',
    });
  });

  afterAll(async () => {
    await db?.close();
  });

  it('cria as tabelas users, products e favorites', async () => {
    await asRole(db, 'postgres');
    const { rows } = await db.query<{ table_name: string }>(
      `select table_name
         from information_schema.tables
        where table_schema = 'public'
        order by table_name`,
    );

    const tables = rows.map((row) => row.table_name);
    expect(tables).toEqual(
      expect.arrayContaining(['favorites', 'products', 'users']),
    );
  });

  it('tabela products tem exatamente as colunas pedidas', async () => {
    const { rows } = await db.query<{ column_name: string }>(
      `select column_name
         from information_schema.columns
        where table_schema = 'public' and table_name = 'products'`,
    );

    const columns = rows.map((row) => row.column_name).sort();
    expect(columns).toEqual(
      [
        'categoria',
        'comissao',
        'created_at',
        'descricao',
        'estrategia',
        'gvm_max',
        'id',
        'imagem',
        'link_tiktok',
        'max_score',
        'nome',
        'pais',
        'preco',
        'quantidade_criadores',
        'status',
        'updated_at',
        'videos_criadores',
      ].sort(),
    );
  });

  it('habilita RLS nas três tabelas', async () => {
    const { rows } = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select relname, relrowsecurity
         from pg_class
        where relnamespace = 'public'::regnamespace
          and relname in ('users', 'products', 'favorites')
        order by relname`,
    );

    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.relrowsecurity, `RLS deveria estar ativa em ${row.relname}`).toBe(true);
    }
  });

  it('cria as políticas de RLS esperadas', async () => {
    const { rows } = await db.query<{ tablename: string; policyname: string }>(
      `select tablename, policyname from pg_policies
        where schemaname = 'public'
        order by tablename, policyname`,
    );

    const names = rows.map((row) => `${row.tablename}.${row.policyname}`);
    expect(names).toEqual(
      expect.arrayContaining([
        'users.users_select_self_or_admin',
        'users.users_update_self',
        'users.users_admin_all',
        'products.products_select_authenticated',
        'products.products_insert_admin',
        'products.products_update_admin',
        'products.products_delete_admin',
        'favorites.favorites_select_own',
        'favorites.favorites_insert_own',
        'favorites.favorites_delete_own',
      ]),
    );
  });

  it('trigger cria o perfil em public.users quando o usuário se cadastra', async () => {
    await asRole(db, 'postgres');
    const { rows } = await db.query<{ email: string; nome: string; role: string }>(
      `select email, nome, role from public.users where id = $1`,
      [userId],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe('assinante@buscadormax.com');
    expect(rows[0].nome).toBe('Ana Assinante');
    expect(rows[0].role).toBe('user');
  });

  it('calcula o MAX SCORE automaticamente (GVM 40% + vídeos 30% + criadores 30%)', async () => {
    await asRole(db, 'postgres');

    const { rows } = await db.query<{ id: string; max_score: string }>(
      `insert into public.products
         (nome, gvm_max, videos_criadores, quantidade_criadores, max_score)
       values ('Produto de teste score', 250000, 250, 100, null)
       returning id, max_score`,
    );

    // 250000/500000*40 = 20 | 250/500*30 = 15 | 100/200*30 = 15 => 50
    expect(Number(rows[0].max_score)).toBe(50);
  });

  it('respeita o teto de cada componente do score', async () => {
    await asRole(db, 'postgres');
    const { rows } = await db.query<{ max_score: string }>(
      `insert into public.products
         (nome, gvm_max, videos_criadores, quantidade_criadores)
       values ('Produto estourado', 99999999, 99999, 99999)
       returning max_score`,
    );
    expect(Number(rows[0].max_score)).toBe(100);
  });

  it('mantém o MAX SCORE informado manualmente pelo admin', async () => {
    await asRole(db, 'postgres');
    const { rows } = await db.query<{ max_score: string }>(
      `insert into public.products
         (nome, gvm_max, videos_criadores, quantidade_criadores, max_score)
       values ('Score manual', 1000, 1, 1, 77.5)
       returning max_score`,
    );
    expect(Number(rows[0].max_score)).toBe(77.5);
  });

  it('recalcula o MAX SCORE quando as métricas mudam', async () => {
    await asRole(db, 'postgres');
    const created = await db.query<{ id: string }>(
      `insert into public.products (nome, gvm_max, videos_criadores, quantidade_criadores)
       values ('Recalculo', 0, 0, 0) returning id`,
    );
    const id = String(created.rows[0].id);

    const { rows } = await db.query<{ max_score: string }>(
      `update public.products
          set gvm_max = 500000, videos_criadores = 500, quantidade_criadores = 200,
              max_score = null
        where id = $1
       returning max_score`,
      [id],
    );
    expect(Number(rows[0].max_score)).toBe(100);
  });

  // -------------------------------------------------------------------------
  // RLS
  // -------------------------------------------------------------------------

  it('visitante não autenticado (anon) não lê produtos', async () => {
    await asRole(db, 'anon');
    const error = await expectFailure(() =>
      db.query('select count(*) from public.products'),
    );
    expect(error.code).toBe('42501');
  });

  it('assinante logado consegue ler a base de produtos', async () => {
    await asRole(db, 'authenticated', userId);
    const { rows } = await db.query<{ count: string }>(
      'select count(*)::text as count from public.products',
    );
    expect(Number(rows[0].count)).toBeGreaterThan(0);
  });

  it('assinante NÃO consegue criar produto (RLS)', async () => {
    await asRole(db, 'authenticated', userId);
    const error = await expectFailure(() =>
      db.query(
        `insert into public.products (nome, categoria, pais)
         values ('Tentativa do assinante', 'Outros', 'BR')`,
      ),
    );

    expect(error.code).toBe('42501');
    expect(error.message.toLowerCase()).toContain('row-level security');
  });

  it('assinante NÃO consegue editar produto (RLS esconde a linha)', async () => {
    await asRole(db, 'authenticated', userId);

    // UPDATE/DELETE com RLS não lançam erro: as linhas simplesmente não são
    // visíveis, então nada é alterado. (insert é o que estoura 42501)
    const updated = await db.query<{ id: string }>(
      `update public.products set nome = 'hackeado' where nome = 'Score manual' returning id`,
    );
    expect(updated.rows).toHaveLength(0);

    const intacto = await db.query<{ count: string }>(
      `select count(*)::text as count from public.products where nome = 'Score manual'`,
    );
    expect(Number(intacto.rows[0].count)).toBe(1);
  });

  it('assinante NÃO consegue excluir produto (RLS esconde a linha)', async () => {
    await asRole(db, 'authenticated', userId);
    const deleted = await db.query<{ id: string }>(
      `delete from public.products where nome = 'Score manual' returning id`,
    );
    expect(deleted.rows).toHaveLength(0);
  });

  it('administrador consegue criar, editar e excluir produto', async () => {
    await asRole(db, 'authenticated', adminId);

    const inserted = await db.query<{ id: string }>(
      `insert into public.products (nome, categoria, pais, gvm_max, videos_criadores, quantidade_criadores)
       values ('Produto do admin', 'Pet', 'BR', 100000, 50, 20)
       returning id`,
    );
    const id = String(inserted.rows[0].id);
    expect(id).toBeTruthy();

    const updated = await db.query<{ nome: string }>(
      `update public.products set nome = 'Produto do admin (editado)' where id = $1 returning nome`,
      [id],
    );
    expect(updated.rows[0].nome).toBe('Produto do admin (editado)');

    const deleted = await db.query<{ id: string }>(
      `delete from public.products where id = $1 returning id`,
      [id],
    );
    expect(deleted.rows).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // PAYWALL (migration 0002): acesso só com assinatura ativa
  // -------------------------------------------------------------------------

  it('novo cadastro nasce com ativo = false e role = user', async () => {
    await asRole(db, 'postgres');
    const { rows } = await db.query<{ ativo: boolean; role: string }>(
      `select ativo, role from public.users where id = $1`,
      [inactiveUserId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].ativo).toBe(false);
    expect(rows[0].role).toBe('user');
  });

  it('usuário sem assinatura ativa NÃO lê a base de produtos (RLS)', async () => {
    await asRole(db, 'authenticated', inactiveUserId);
    const { rows } = await db.query<{ count: string }>(
      'select count(*)::text as count from public.products',
    );
    expect(Number(rows[0].count)).toBe(0);
  });

  it('usuário sem assinatura ativa NÃO consegue favoritar (RLS)', async () => {
    await asRole(db, 'postgres');
    const { rows } = await db.query<{ id: string }>(
      `select id from public.products order by nome limit 1`,
    );
    const productId = String(rows[0].id);

    await asRole(db, 'authenticated', inactiveUserId);
    const error = await expectFailure(() =>
      db.query(`insert into public.favorites (user_id, product_id) values ($1, $2)`, [
        inactiveUserId,
        productId,
      ]),
    );
    expect(error.code).toBe('42501');
  });

  it('usuário sem assinatura ativa continua lendo o PRÓPRIO perfil', async () => {
    // a aplicação precisa dessa leitura para exibir a tela de bloqueio
    await asRole(db, 'authenticated', inactiveUserId);
    const { rows } = await db.query<{ ativo: boolean }>(
      `select ativo from public.users where id = $1`,
      [inactiveUserId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].ativo).toBe(false);
  });

  it('usuário comum NÃO consegue ativar a própria assinatura', async () => {
    await asRole(db, 'authenticated', inactiveUserId);
    const error = await expectFailure(() =>
      db.query(`update public.users set ativo = true where id = $1`, [inactiveUserId]),
    );
    expect(error.code).toBe('42501');

    const { rows } = await db.query<{ ativo: boolean }>(
      `select ativo from public.users where id = $1`,
      [inactiveUserId],
    );
    expect(rows[0].ativo).toBe(false);
  });

  it('liberação manual (admin no SQL Editor) devolve o acesso', async () => {
    await asRole(db, 'postgres');
    await db.query(`update public.users set ativo = true where id = $1`, [inactiveUserId]);

    await asRole(db, 'authenticated', inactiveUserId);
    const { rows } = await db.query<{ count: string }>(
      'select count(*)::text as count from public.products',
    );
    expect(Number(rows[0].count)).toBeGreaterThan(0);

    // volta ao estado pendente para os demais testes
    await asRole(db, 'postgres');
    await db.query(`update public.users set ativo = false where id = $1`, [inactiveUserId]);
  });

  it('admin continua acessando o catálogo mesmo com ativo = false', async () => {
    await asRole(db, 'postgres');
    await db.query(`update public.users set ativo = false where id = $1`, [adminId]);

    await asRole(db, 'authenticated', adminId);
    const { rows } = await db.query<{ count: string }>(
      'select count(*)::text as count from public.products',
    );
    expect(Number(rows[0].count)).toBeGreaterThan(0);

    await asRole(db, 'postgres');
    await db.query(`update public.users set ativo = true where id = $1`, [adminId]);
  });

  it('has_active_subscription() responde corretamente por cenário', async () => {
    await asRole(db, 'authenticated', adminId);
    const admin = await db.query<{ ok: boolean }>('select public.has_active_subscription() as ok');
    expect(admin.rows[0].ok).toBe(true);

    await asRole(db, 'authenticated', userId);
    const ativo = await db.query<{ ok: boolean }>('select public.has_active_subscription() as ok');
    expect(ativo.rows[0].ok).toBe(true);

    await asRole(db, 'authenticated', inactiveUserId);
    const pendente = await db.query<{ ok: boolean }>(
      'select public.has_active_subscription() as ok',
    );
    expect(pendente.rows[0].ok).toBe(false);

    await asRole(db, 'anon');
    const anon = await db.query<{ ok: boolean }>('select public.has_active_subscription() as ok');
    expect(anon.rows[0].ok).toBe(false);
  });

  it('assinante não consegue promover o próprio perfil a admin', async () => {
    await asRole(db, 'authenticated', userId);
    const error = await expectFailure(() =>
      db.query(`update public.users set role = 'admin' where id = $1`, [userId]),
    );
    expect(error.code).toBe('42501');
  });

  it('assinante não consegue alterar o perfil de outra pessoa', async () => {
    await asRole(db, 'authenticated', userId);
    const updated = await db.query<{ id: string }>(
      `update public.users set nome = 'invasor' where id = $1 returning id`,
      [otherUserId],
    );
    expect(updated.rows).toHaveLength(0);

    const intacto = await db.query<{ nome: string }>(
      `select nome from public.users where id = $1`,
      [otherUserId],
    );
    // a leitura também é bloqueada: nenhuma linha visível
    expect(intacto.rows).toHaveLength(0);
  });

  it('assinante consegue atualizar o próprio nome', async () => {
    await asRole(db, 'authenticated', userId);
    const { rows } = await db.query<{ nome: string }>(
      `update public.users set nome = 'Ana Atualizada' where id = $1 returning nome`,
      [userId],
    );
    expect(rows[0].nome).toBe('Ana Atualizada');
  });

  it('assinante não enxerga o perfil de outros usuários', async () => {
    await asRole(db, 'authenticated', userId);
    const { rows } = await db.query<{ id: string }>(
      `select id from public.users`,
    );
    expect(rows.map((row) => String(row.id))).toEqual([userId]);
  });

  it('admin enxerga todos os perfis', async () => {
    await asRole(db, 'authenticated', adminId);
    const { rows } = await db.query<{ id: string }>(
      `select id from public.users order by email`,
    );
    expect(rows).toHaveLength(4);
  });

  it('favoritos: usuário salva, lê e remove apenas os próprios', async () => {
    await asRole(db, 'postgres');
    const { rows } = await db.query<{ id: string }>(
      `select id from public.products order by nome limit 1`,
    );
    const productId = String(rows[0].id);

    await asRole(db, 'authenticated', userId);
    await db.query(`insert into public.favorites (user_id, product_id) values ($1, $2)`, [
      userId,
      productId,
    ]);

    const mine = await db.query<{ product_id: string }>(
      `select product_id from public.favorites`,
    );
    expect(mine.rows.map((row) => String(row.product_id))).toEqual([productId]);

    // não pode favoritar em nome de outro usuário
    const error = await expectFailure(() =>
      db.query(`insert into public.favorites (user_id, product_id) values ($1, $2)`, [
        otherUserId,
        productId,
      ]),
    );
    expect(error.code).toBe('42501');

    // remove o próprio favorito
    const deleted = await db.query<{ product_id: string }>(
      `delete from public.favorites where product_id = $1 returning product_id`,
      [productId],
    );
    expect(deleted.rows).toHaveLength(1);
  });

  it('favoritos de outro usuário não aparecem na leitura', async () => {
    await asRole(db, 'postgres');
    const { rows } = await db.query<{ id: string }>(
      `select id from public.products order by nome limit 1`,
    );
    const productId = String(rows[0].id);

    await db.query(`insert into public.favorites (user_id, product_id) values ($1, $2)`, [
      otherUserId,
      productId,
    ]);

    await asRole(db, 'authenticated', userId);
    const visible = await db.query<{ product_id: string }>(
      `select product_id from public.favorites`,
    );
    expect(visible.rows).toHaveLength(0);

    const deleted = await db.query<{ product_id: string }>(
      `delete from public.favorites where product_id = $1 returning product_id`,
      [productId],
    );
    expect(deleted.rows).toHaveLength(0);
  });

  it('ensure_profile bloqueia a criação de perfil de terceiro', async () => {
    await asRole(db, 'authenticated', userId);
    const error = await expectFailure(() =>
      db.query(`select public.ensure_profile($1, 'terceiro@exemplo.com', null)`, [
        otherUserId,
      ]),
    );
    expect(error.message.toLowerCase()).toContain('não é permitido criar perfil');
  });

  it('is_admin() responde corretamente por role', async () => {
    await asRole(db, 'authenticated', adminId);
    const admin = await db.query<{ is_admin: boolean }>('select public.is_admin()');
    expect(admin.rows[0].is_admin).toBe(true);

    await asRole(db, 'authenticated', userId);
    const user = await db.query<{ is_admin: boolean }>('select public.is_admin()');
    expect(user.rows[0].is_admin).toBe(false);

    await asRole(db, 'anon');
    const anon = await db.query<{ is_admin: boolean }>('select public.is_admin()');
    expect(anon.rows[0].is_admin).toBe(false);
  });

  it('rejeita status e comissão inválidos (constraints de checagem)', async () => {
    await asRole(db, 'authenticated', adminId);

    const statusError = await expectFailure(() =>
      db.query(
        `insert into public.products (nome, status) values ('Status inválido', 'sumido')`,
      ),
    );
    expect(statusError.code).toBe('23514');

    const comissaoError = await expectFailure(() =>
      db.query(
        `insert into public.products (nome, comissao) values ('Comissão inválida', 180)`,
      ),
    );
    expect(comissaoError.code).toBe('23514');
  });

  it('seed.sql roda e é idempotente', async () => {
    const { readFileSync } = await import('node:fs');
    const { SEED_PATH } = await import('./harness');
    const seed = readFileSync(SEED_PATH, 'utf8');

    await asRole(db, 'postgres');
    await db.exec(seed);
    const first = await db.query<{ count: string }>(
      `select count(*)::text as count from public.products`,
    );

    await db.exec(seed);
    const second = await db.query<{ count: string }>(
      `select count(*)::text as count from public.products`,
    );

    expect(Number(second.rows[0].count)).toBe(Number(first.rows[0].count));
    expect(Number(first.rows[0].count)).toBeGreaterThanOrEqual(20);
  });
});

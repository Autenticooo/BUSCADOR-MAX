import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';

import {
  asRole,
  createAuthUser,
  createTestDatabase,
  expectFailure,
} from './harness';

/**
 * Migration 0004 (supabase/migrations/0004_kiwify_only_activation.sql):
 * o acesso só nasce do pagamento confirmado na Kiwify.
 *
 * O harness aplica TODAS as migrations em ordem, então aqui o banco já tem
 * 0001 + 0002 + 0003 + 0004 — exatamente o estado de um projeto real.
 */

/** chamada da RPC do webhook devolvendo os campos que interessam */
const RPC_PAGAMENTO = `
  with r as (
    select public.aplicar_pagamento_kiwify(
      $1::text, $2::boolean, $3::text, $4::text, $5::timestamptz
    ) as u
  )
  select (u).id                                       as id,
         (u).ativo                                    as ativo,
         (u).plano                                    as plano,
         (u).kiwify_transaction_id                    as kiwify_transaction_id,
         ((u).assinatura_desde at time zone 'UTC')::text as assinatura_desde
    from r
`;

interface RpcRow {
  id: string | null;
  ativo: boolean | null;
  plano: string | null;
  kiwify_transaction_id: string | null;
  assinatura_desde: string | null;
}

describe('migração 0004 — acesso liberado só pelo pagamento', () => {
  let db: PGlite;
  let adminId: string;
  let pendingId: string;
  let buyerId: string;

  beforeAll(async () => {
    db = await createTestDatabase();
    await asRole(db, 'postgres');

    adminId = await createAuthUser(db, 'admin@buscadormax.com', {
      admin: true,
      nome: 'Admin Max',
    });
    pendingId = await createAuthUser(db, 'pendente@buscadormax.com', {
      nome: 'Sem Pagamento',
    });
    buyerId = await createAuthUser(db, 'cliente@buscadormax.com', {
      nome: 'Cliente Kiwify',
    });

    await db.query(
      `insert into public.products (nome, categoria, pais, gvm_max, videos_criadores, quantidade_criadores)
       values ('Produto da base', 'Outros', 'BR', 100000, 100, 50)`,
    );
  });

  afterAll(async () => {
    await db?.close();
  });

  // ---------------------------------------------------------------------------
  // 1. cadastro novo
  // ---------------------------------------------------------------------------

  it('novo cadastro nasce com ativo = false e role = user', async () => {
    await asRole(db, 'postgres');
    const { rows } = await db.query<{ ativo: boolean; role: string }>(
      `select ativo, role from public.users where id = $1`,
      [pendingId],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].ativo).toBe(false);
    expect(rows[0].role).toBe('user');
  });

  it('a coluna ativo tem default false e é NOT NULL', async () => {
    await asRole(db, 'postgres');
    const { rows } = await db.query<{
      column_default: string;
      is_nullable: string;
    }>(
      `select column_default, is_nullable
         from information_schema.columns
        where table_schema = 'public'
          and table_name = 'users'
          and column_name = 'ativo'`,
    );

    expect(rows[0].column_default).toBe('false');
    expect(rows[0].is_nullable).toBe('NO');
  });

  it('perfil recém-criado não lê a base de produtos', async () => {
    await asRole(db, 'authenticated', pendingId);
    const { rows } = await db.query<{ count: string }>(
      `select count(*)::text as count from public.products`,
    );
    expect(Number(rows[0].count)).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // 2. confirmação de e-mail NÃO libera acesso
  // ---------------------------------------------------------------------------

  it('confirmação de e-mail (UPDATE em auth.users) não libera o acesso', async () => {
    await asRole(db, 'postgres');

    // é assim que o Supabase marca o e-mail confirmado: um UPDATE em auth.users
    await db.query(
      `update auth.users
          set email = 'Pendente@BuscadorMax.com',
              raw_user_meta_data = jsonb_set(raw_user_meta_data, '{email_confirmado}', 'true'::jsonb)
        where id = $1`,
      [pendingId],
    );

    const { rows } = await db.query<{ ativo: boolean; email: string }>(
      `select ativo, email from public.users where id = $1`,
      [pendingId],
    );

    // o e-mail foi sincronizado; o acesso NÃO
    expect(rows[0].email).toBe('Pendente@BuscadorMax.com');
    expect(rows[0].ativo).toBe(false);

    await asRole(db, 'authenticated', pendingId);
    const liberado = await db.query<{ ok: boolean }>(
      `select public.has_active_subscription() as ok`,
    );
    expect(liberado.rows[0].ok).toBe(false);

    const catalogo = await db.query<{ count: string }>(
      `select count(*)::text as count from public.products`,
    );
    expect(Number(catalogo.rows[0].count)).toBe(0);

    // restaura o e-mail minúsculo para os demais testes
    await asRole(db, 'postgres');
    await db.query(`update auth.users set email = 'pendente@buscadormax.com' where id = $1`, [
      pendingId,
    ]);
  });

  // ---------------------------------------------------------------------------
  // 3. usuário comum não se ativa
  // ---------------------------------------------------------------------------

  it('usuário comum NÃO consegue ativar a própria assinatura', async () => {
    await asRole(db, 'authenticated', pendingId);
    const error = await expectFailure(() =>
      db.query(`update public.users set ativo = true where id = $1`, [pendingId]),
    );

    expect(error.code).toBe('42501');

    const { rows } = await db.query<{ ativo: boolean }>(
      `select ativo from public.users where id = $1`,
      [pendingId],
    );
    expect(rows[0].ativo).toBe(false);
  });

  it('usuário comum NÃO consegue desativar o próprio acesso nem mexer no plano', async () => {
    // assinante JÁ liberado: é o cenário em que o ataque faria diferença
    await asRole(db, 'postgres');
    await db.query(`update public.users set ativo = true where id = $1`, [buyerId]);

    await asRole(db, 'authenticated', buyerId);

    const ativo = await expectFailure(() =>
      db.query(`update public.users set ativo = false where id = $1`, [buyerId]),
    );
    expect(ativo.code).toBe('42501');

    const plano = await expectFailure(() =>
      db.query(`update public.users set plano = 'Plano de Graça' where id = $1`, [buyerId]),
    );
    expect(plano.code).toBe('42501');

    const role = await expectFailure(() =>
      db.query(`update public.users set role = 'admin' where id = $1`, [buyerId]),
    );
    expect(role.code).toBe('42501');

    // o nome continua editável: a trava é só nos campos de acesso/assinatura
    const { rows } = await db.query<{ nome: string }>(
      `update public.users set nome = 'Cliente Kiwify' where id = $1 returning nome`,
      [buyerId],
    );
    expect(rows[0].nome).toBe('Cliente Kiwify');

    await asRole(db, 'postgres');
    await db.query(`update public.users set ativo = false where id = $1`, [buyerId]);
  });

  it('usuário comum NÃO consegue chamar a RPC do webhook', async () => {
    await asRole(db, 'authenticated', pendingId);
    const error = await expectFailure(() =>
      db.query(RPC_PAGAMENTO, [
        'pendente@buscadormax.com',
        true,
        'Plano pirateado',
        'ord_fake',
        '2026-09-01T12:00:00Z',
      ]),
    );

    expect(error.code).toBe('42501');
  });

  it('perfil inserido por caminho não privilegiado nasce pendente', async () => {
    await asRole(db, 'postgres');

    // papel que ignora RLS (como a service role) mas NÃO é escritor privilegiado
    await db.exec(`
      do $$ begin
        create role invasor_bypass nologin bypassrls;
      exception when duplicate_object then null; end $$;
      grant usage on schema public to invasor_bypass;
      grant select, insert on public.users to invasor_bypass;
      grant execute on function public.is_privileged_writer() to invasor_bypass;
      grant execute on function public.is_admin() to invasor_bypass;
    `);

    // usuário do Auth sem perfil em public.users
    const invasorId = await createAuthUser(db, 'invasor@buscadormax.com');
    await db.query(`delete from public.users where id = $1`, [invasorId]);

    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [invasorId]);
    await db.query('set role invasor_bypass');

    const { rows } = await db.query<{ ativo: boolean; role: string }>(
      `insert into public.users (id, email, nome, role, ativo)
       values ($1, 'invasor@buscadormax.com', 'Invasor', 'admin', true)
       returning ativo, role`,
      [invasorId],
    );

    expect(rows[0].ativo).toBe(false);
    expect(rows[0].role).toBe('user');

    await asRole(db, 'postgres');
    await db.query(`delete from public.users where id = $1`, [invasorId]);
  });

  // ---------------------------------------------------------------------------
  // 4. só o pagamento confirmado libera
  // ---------------------------------------------------------------------------

  it('webhook (service role) libera o acesso com a RPC do pagamento', async () => {
    // sem JWT: é o contexto da rota /api/webhook/kiwify com a service role
    await asRole(db, 'postgres');

    const { rows } = await db.query<RpcRow>(RPC_PAGAMENTO, [
      'CLIENTE@buscadormax.com', // e-mail do checkout pode vir em outra caixa
      true,
      'BUSCADOR MAX — Mensal',
      'ord_9f2c1',
      '2026-09-20T14:32:10Z',
    ]);

    expect(rows[0].id).toBe(buyerId);
    expect(rows[0].ativo).toBe(true);
    expect(rows[0].plano).toBe('BUSCADOR MAX — Mensal');
    expect(rows[0].kiwify_transaction_id).toBe('ord_9f2c1');
    expect(rows[0].assinatura_desde).toContain('2026-09-20');

    await asRole(db, 'authenticated', buyerId);
    const catalogo = await db.query<{ count: string }>(
      `select count(*)::text as count from public.products`,
    );
    expect(Number(catalogo.rows[0].count)).toBeGreaterThan(0);

    const liberado = await db.query<{ ok: boolean }>(
      `select public.has_active_subscription() as ok`,
    );
    expect(liberado.rows[0].ok).toBe(true);
  });

  it('RPC devolve NULL para comprador sem conta (webhook responde 200)', async () => {
    await asRole(db, 'postgres');
    const { rows } = await db.query<RpcRow>(RPC_PAGAMENTO, [
      'ninguem@exemplo.com',
      true,
      'BUSCADOR MAX — Mensal',
      'ord_sem_conta',
      null,
    ]);

    expect(rows[0].id).toBeNull();
    expect(rows[0].ativo).toBeNull();
  });

  it('reembolso/chargeback pela mesma RPC suspende o acesso', async () => {
    await asRole(db, 'postgres');
    const { rows } = await db.query<RpcRow>(RPC_PAGAMENTO, [
      'cliente@buscadormax.com',
      false,
      null,
      null,
      null,
    ]);

    expect(rows[0].ativo).toBe(false);
    // os dados da compra ficam para rastreio
    expect(rows[0].kiwify_transaction_id).toBe('ord_9f2c1');

    await asRole(db, 'authenticated', buyerId);
    const catalogo = await db.query<{ count: string }>(
      `select count(*)::text as count from public.products`,
    );
    expect(Number(catalogo.rows[0].count)).toBe(0);
  });

  it('update direto com service role também funciona (sem RPC)', async () => {
    await asRole(db, 'postgres');
    const { rows } = await db.query<{ ativo: boolean }>(
      `update public.users set ativo = true where id = $1 returning ativo`,
      [buyerId],
    );
    expect(rows[0].ativo).toBe(true);

    // devolve ao estado pendente
    await db.query(`update public.users set ativo = false where id = $1`, [buyerId]);
  });

  // ---------------------------------------------------------------------------
  // 5. admin
  // ---------------------------------------------------------------------------

  it('admin logado consegue liberar e suspender o acesso de um assinante', async () => {
    await asRole(db, 'authenticated', adminId);

    const liberado = await db.query<{ ativo: boolean }>(
      `update public.users set ativo = true where id = $1 returning ativo`,
      [pendingId],
    );
    expect(liberado.rows[0].ativo).toBe(true);

    const suspenso = await db.query<{ ativo: boolean }>(
      `update public.users set ativo = false where id = $1 returning ativo`,
      [pendingId],
    );
    expect(suspenso.rows[0].ativo).toBe(false);
  });

  it('admin continua com acesso mesmo com ativo = false', async () => {
    await asRole(db, 'postgres');
    await db.query(`update public.users set ativo = false where id = $1`, [adminId]);

    await asRole(db, 'authenticated', adminId);
    const liberado = await db.query<{ ok: boolean }>(
      `select public.has_active_subscription() as ok`,
    );
    expect(liberado.rows[0].ok).toBe(true);

    const catalogo = await db.query<{ count: string }>(
      `select count(*)::text as count from public.products`,
    );
    expect(Number(catalogo.rows[0].count)).toBeGreaterThan(0);

    // CRUD de produtos exige is_admin(), que pede role = 'admin' E ativo = true
    const semCruds = await db.query<{ ok: boolean }>(`select public.is_admin() as ok`);
    expect(semCruds.rows[0].ok).toBe(false);

    await asRole(db, 'postgres');
    await db.query(`update public.users set ativo = true where id = $1`, [adminId]);

    await asRole(db, 'authenticated', adminId);
    const comCrud = await db.query<{ ok: boolean }>(`select public.is_admin() as ok`);
    expect(comCrud.rows[0].ok).toBe(true);
  });

  it('a migration 0004 é idempotente (pode rodar de novo no mesmo banco)', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
    const sql = readFileSync(
      join(root, 'supabase/migrations/0004_kiwify_only_activation.sql'),
      'utf8',
    );

    await asRole(db, 'postgres');
    await db.exec(sql);
    await db.exec(sql);

    const { rows } = await db.query<{ count: string }>(
      `select count(*)::text as count
         from pg_trigger
        where tgrelid = 'public.users'::regclass
          and tgname = 'users_protect_role_ativo'`,
    );
    expect(Number(rows[0].count)).toBe(1);
  });
});

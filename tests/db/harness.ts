import { PGlite, type PGlite as PGliteType } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

export const MIGRATION_PATH = join(ROOT, 'supabase/migrations/0001_init.sql');
export const SEED_PATH = join(ROOT, 'supabase/seed.sql');

export type Role = 'postgres' | 'anon' | 'authenticated';

/**
 * Sobe um Postgres real (PGlite = Postgres compilado para WASM) com o mesmo
 * layout de um projeto Supabase: schema `auth`, roles anon/authenticated e
 * a função auth.uid() lendo o claim JWT. Depois aplica a migration do projeto.
 */
export async function createTestDatabase(): Promise<PGliteType> {
  const db = new PGlite();

  await db.exec(`
    create schema if not exists auth;

    create table auth.users (
      id uuid primary key default gen_random_uuid(),
      email text unique not null,
      raw_user_meta_data jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );

    create or replace function auth.uid()
    returns uuid
    language sql
    stable
    as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;

    do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
    do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
    do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;

    grant usage on schema auth to anon, authenticated, service_role;
    grant select on auth.users to authenticated, service_role;
  `);

  await db.exec(readFileSync(MIGRATION_PATH, 'utf8'));

  return db;
}

/** Cria o usuário no Auth (dispara o trigger que cria o perfil) */
export async function createAuthUser(
  db: PGliteType,
  email: string,
  options: { admin?: boolean; nome?: string } = {},
): Promise<string> {
  const result = await db.query<{ id: string }>(
    `insert into auth.users (email, raw_user_meta_data)
     values ($1, $2::jsonb)
     returning id`,
    [email, JSON.stringify({ nome: options.nome ?? null })],
  );

  const id = String(result.rows[0].id);

  if (options.admin) {
    await db.query(`update public.users set role = 'admin' where id = $1`, [id]);
  }

  return id;
}

/**
 * Troca a role da conexão e o claim de usuário, simulando o que o
 * PostgREST faz a cada request do Supabase.
 */
export async function asRole(
  db: PGliteType,
  role: Role,
  userId?: string,
): Promise<void> {
  await db.query('reset role');
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [
    userId ?? '',
  ]);
  if (role !== 'postgres') await db.query(`set role ${role}`);
}

export interface PgError {
  message: string;
  code?: string;
}

/** Executa esperando falha e devolve o erro do Postgres */
export async function expectFailure(
  fn: () => Promise<unknown>,
): Promise<PgError> {
  try {
    await fn();
  } catch (error) {
    const pgError = error as PgError;
    return { message: pgError.message ?? String(error), code: pgError.code };
  }
  throw new Error('esperava uma falha do Postgres, mas a consulta succeeded');
}

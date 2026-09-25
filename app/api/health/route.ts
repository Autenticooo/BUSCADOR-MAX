import { NextResponse } from 'next/server';

import { supabaseEnv } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const NETWORK = /fetch failed|failed to fetch|econnreset|econnrefused|etimedout|enotfound|socket hang up|networkerror/i;

/**
 * Diagnóstico da integração com o Supabase.
 * GET /api/health
 *
 * Nunca expõe a chave: devolve apenas o formato dela e o resultado das sondas.
 *
 * Como ler `rest.schema`:
 *  - "aplicado"      → a tabela public.products existe (mesmo que o RLS negue a leitura)
 *  - "nao_aplicado"  → PostgREST não achou a relação: rode 0001_init.sql
 *  - "inacessivel"   → o servidor não conseguiu falar com o Supabase (rede/egress)
 */
export async function GET() {
  const env = supabaseEnv();
  const base = {
    configured: env.configured,
    url: env.configured ? env.url : null,
    keyFormat: describeKeyFormat(env.anonKey),
  };

  if (!env.configured) {
    return NextResponse.json(
      { ...base, status: 'nao_configurado', hint: 'Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY em .env.local' },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const startedAt = Date.now();

  // 1) PostgREST + schema + RLS (a anon key não lê products, e é assim mesmo)
  const { error, count } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true });

  const rest = classifyRestError(error, count);

  // 2) serviço de Auth
  const auth = await probeAuth(env.url, env.anonKey);

  const latencyMs = Date.now() - startedAt;
  const reachable = rest.schema !== 'inacessivel' && auth.reachable;

  return NextResponse.json(
    {
      ...base,
      status: reachable ? 'ok' : 'degradado',
      latencyMs,
      rest,
      auth,
      hint: buildHint(rest, auth),
    },
    { status: reachable ? 200 : 502 },
  );
}

function describeKeyFormat(key: string): string {
  if (key.startsWith('sb_publishable_')) return 'publishable (formato novo)';
  if (key.startsWith('sb_secret_')) return 'secret — não use no cliente';
  if (key.split('.').length === 3) return 'jwt legado (anon)';
  return 'desconhecido';
}

function classifyRestError(
  error: { message: string; code?: string; status?: number } | null,
  count: number | null,
) {
  if (!error) {
    return { reachable: true, schema: 'aplicado', count, detail: null as string | null };
  }

  const message = String(error.message ?? '');
  const code = String(error.code ?? '');

  if (NETWORK.test(message)) {
    return { reachable: false, schema: 'inacessivel', count: null, detail: message };
  }
  if (code === '42501' || /permission denied|row-level security/i.test(message)) {
    // esperado para a publishable/anon key: a tabela existe e o RLS protege
    return { reachable: true, schema: 'aplicado', count: null, detail: message };
  }
  if (code === 'PGRST205' || /could not find the table|does not exist/i.test(message)) {
    return { reachable: true, schema: 'nao_aplicado', count: null, detail: message };
  }
  return { reachable: true, schema: `erro: ${code || message}`, count: null, detail: message };
}

async function probeAuth(url: string, apiKey: string) {
  try {
    const response = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: apiKey },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    const body = await response.text();
    return { reachable: response.ok, status: response.status, detail: body.slice(0, 200) };
  } catch (error) {
    return {
      reachable: false,
      status: null,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

function buildHint(
  rest: { reachable: boolean; schema: string },
  auth: { reachable: boolean },
): string {
  if (!rest.reachable || !auth.reachable) {
    return 'O servidor não alcançou o Supabase. Em sandbox/CI sem egress isso é esperado; ' +
      'rode localmente ou no ambiente de deploy.';
  }
  if (rest.schema === 'nao_aplicado') {
    return 'Rode supabase/migrations/0001_init.sql no SQL Editor do Supabase.';
  }
  return 'Integração pronta: schema aplicado e RLS ativo.';
}

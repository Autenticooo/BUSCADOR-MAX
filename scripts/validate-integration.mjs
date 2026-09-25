#!/usr/bin/env node
/**
 * BUSCADOR MAX — validação ponta a ponta contra um projeto Supabase real.
 *
 * Uso:
 *   ADMIN_EMAIL=admin@exemplo.com ADMIN_PASSWORD='senha' npm run validate
 *
 * Opcionais:
 *   USER_EMAIL / USER_PASSWORD  usuário comum (se não vier, o script cria um
 *                               temporário via signUp; use --no-signup para pular)
 *   URL / ANON_KEY              sobrescrevem o .env.local
 *
 * Valida exatamente:
 *   1. login com Supabase Auth
 *   2. acesso ao dashboard (as consultas que a página faz)
 *   3. acesso à área admin
 *   4. CRUD de produtos
 *   5. permissões de usuário comum x administrador
 *
 * Nenhuma credencial é impressa na saída.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------------------
// ambiente
// ---------------------------------------------------------------------------
function loadEnvLocal() {
  const path = join(ROOT, '.env.local');
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (match) out[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

const envFile = loadEnvLocal();
const URL_SUPABASE = process.env.URL ?? envFile.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.ANON_KEY ?? envFile.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const USER_EMAIL = process.env.USER_EMAIL;
const USER_PASSWORD = process.env.USER_PASSWORD;
const NO_SIGNUP = process.argv.includes('--no-signup');

// ---------------------------------------------------------------------------
// runner
// ---------------------------------------------------------------------------
const results = [];
let currentGroup = '';

function group(name) {
  currentGroup = name;
  console.log(`\n\x1b[1m${name}\x1b[0m`);
}

async function check(label, fn) {
  try {
    const detail = await fn();
    results.push({ group: currentGroup, label, status: 'ok', detail });
    console.log(`  \x1b[32m✓\x1b[0m ${label}${detail ? `  \x1b[90m${detail}\x1b[0m` : ''}`);
  } catch (error) {
    const skipped = error?.skipped === true;
    results.push({
      group: currentGroup,
      label,
      status: skipped ? 'skip' : 'fail',
      detail: error.message,
    });
    const mark = skipped ? '\x1b[33m–\x1b[0m' : '\x1b[31m✗\x1b[0m';
    console.log(`  ${mark} ${label}\n      \x1b[90m${error.message}\x1b[0m`);
  }
}

function skip(message) {
  const error = new Error(message);
  error.skipped = true;
  throw error;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const NETWORK = /fetch failed|failed to fetch|econnreset|econnrefused|etimedout|enotfound/i;

/** espelho de public.calcular_max_score() */
function maxScoreEsperado(gvm, videos, criadores) {
  const clamp = (n) => Math.min(Math.max(Number(n) || 0, 0), 1);
  const raw =
    clamp(gvm / 500000) * 40 + clamp(videos / 500) * 30 + clamp(criadores / 200) * 30;
  return Math.round(raw * 100) / 100;
}

function startOfTodayISO(timeZone = 'America/Sao_Paulo') {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .formatToParts(new Date())
    .reduce((acc, p) => ((acc[p.type] = p.value), acc), {});
  return new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day)).toISOString();
}

// ---------------------------------------------------------------------------
// execução
// ---------------------------------------------------------------------------
const NOME_TESTE = `__validacao_buscador_max_${Date.now()}`;
let adminClient = null;
let adminId = null;
let userClient = null;
let userId = null;
let produtoId = null;
let tempUserEmail = null;

async function main() {
  console.log('\x1b[1mBUSCADOR MAX — validação da integração Supabase\x1b[0m');
  console.log(`projeto: ${URL_SUPABASE ?? '(não configurado)'}`);
  console.log(
    `chave:   ${ANON_KEY?.startsWith('sb_publishable_') ? 'publishable (formato novo)' : ANON_KEY?.split('.').length === 3 ? 'jwt legado (anon)' : '(não configurada)'}`,
  );

  if (!URL_SUPABASE || !ANON_KEY) {
    console.log('\n\x1b[31mFalta NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.\x1b[0m');
    process.exit(2);
  }
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.log(
      '\n\x1b[31mInforme as credenciais do admin:\x1b[0m\n' +
        "  ADMIN_EMAIL=voce@exemplo.com ADMIN_PASSWORD='sua-senha' npm run validate",
    );
    process.exit(2);
  }

  // -------------------------------------------------------------------------
  group('0. Conectividade');
  await check('servidor alcança o Supabase', async () => {
    const response = await fetch(`${URL_SUPABASE}/auth/v1/health`, {
      headers: { apikey: ANON_KEY },
      signal: AbortSignal.timeout(10000),
    }).catch((error) => {
      throw new Error(
        `sem conexão com o Supabase (${error.message}). ` +
          `Rode este script numa máquina com acesso à internet.`,
      );
    });
    assert(response.ok, `auth/health respondeu ${response.status}`);
    return `HTTP ${response.status}`;
  });

  const semRede = results.some(
    (r) => r.group === '0. Conectividade' && r.status === 'fail',
  );
  if (semRede) {
    console.log(
      '\n\x1b[31mSem conexão com o Supabase a partir desta máquina.\x1b[0m ' +
        'As demais verificações dependem dela e foram abortadas.',
    );
    return;
  }

  await check('schema aplicado (public.products existe)', async () => {
    const probe = createClient(URL_SUPABASE, ANON_KEY);
    const { error } = await probe.from('products').select('id', { head: true, count: 'exact' });
    if (!error) return 'tabela acessível';
    if (error.code === '42501' || /permission denied|row-level security/i.test(error.message)) {
      return 'tabela existe e o RLS bloqueia a publishable key (correto)';
    }
    if (error.code === 'PGRST205' || /could not find the table|does not exist/i.test(error.message)) {
      throw new Error('rode supabase/migrations/0001_init.sql no SQL Editor');
    }
    throw new Error(error.message);
  });

  // -------------------------------------------------------------------------
  group('1. Login com Supabase Auth');
  await check('admin faz login', async () => {
    adminClient = createClient(URL_SUPABASE, ANON_KEY);
    const { data, error } = await adminClient.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    if (error) {
      if (NETWORK.test(error.message)) throw new Error(`rede: ${error.message}`);
      if (/invalid api key/i.test(error.message)) {
        throw new Error('apikey rejeitada — troque pela anon key legada (JWT)');
      }
      throw new Error(`${error.name}: ${error.message}`);
    }
    adminId = data.user.id;
    return `sessão de ${Math.round((data.session.expires_at - Date.now() / 1000) / 60)} min`;
  });

  // -------------------------------------------------------------------------
  group('2. Área admin (perfil e role)');
  await check('perfil existe em public.users', async () => {
    const { data, error } = await adminClient
      .from('users')
      .select('id, email, nome, role, ativo')
      .eq('id', adminId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      throw new Error(
        'a linha em public.users não existe. Faça login uma vez na aplicação ' +
          '(a RPC ensure_profile cria o perfil) e repita a validação.',
      );
    }
    return `${data.email} · role=${data.role}`;
  });

  await check("role do admin é 'admin'", async () => {
    const { data, error } = await adminClient
      .from('users')
      .select('role')
      .eq('id', adminId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('perfil não encontrado em public.users');
    if (data.role !== 'admin') {
      throw new Error(
        `role='${data.role}'. O UPDATE provavelmente rodou antes do perfil existir e ` +
          `afetou 0 linhas. Rode: update public.users set role='admin' where id='${adminId}';`,
      );
    }
    return 'ok';
  });

  await check('is_admin() responde true para o admin', async () => {
    const { data, error } = await adminClient.rpc('is_admin');
    if (error) throw new Error(error.message);
    assert(data === true, `is_admin() retornou ${JSON.stringify(data)}`);
    return 'true';
  });

  // -------------------------------------------------------------------------
  group('3. CRUD de produtos (como admin)');
  const metricas = { gvm_max: 250000, videos_criadores: 250, quantidade_criadores: 100 };

  await check('CREATE + MAX SCORE calculado pelo trigger', async () => {
    const { data, error } = await adminClient
      .from('products')
      .insert({
        nome: NOME_TESTE,
        categoria: 'Outros',
        pais: 'BR',
        preco: 89.9,
        comissao: 20,
        descricao: 'Produto criado pela validação automática.',
        link_tiktok: 'https://shop.tiktok.com/view/product/0000000000',
        estrategia: 'Validação de integração.',
        status: 'ativo',
        ...metricas,
        // max_score propositalmente ausente: o trigger deve calcular
      })
      .select('*')
      .single();

    if (error) throw new Error(`${error.code ?? ''} ${error.message}`.trim());
    produtoId = data.id;

    const esperado = maxScoreEsperado(
      metricas.gvm_max,
      metricas.videos_criadores,
      metricas.quantidade_criadores,
    );
    const obtido = Number(data.max_score);
    assert(
      Math.abs(obtido - esperado) < 0.01,
      `max_score=${obtido}, esperado ${esperado} (o trigger não calculou?)`,
    );
    return `id=${produtoId.slice(0, 8)}… · max_score=${obtido}`;
  });

  await check('READ (detalhe do produto)', async () => {
    const { data, error } = await adminClient
      .from('products')
      .select('*')
      .eq('id', produtoId)
      .single();
    if (error) throw new Error(error.message);
    assert(data.nome === NOME_TESTE, 'nome não confere');
    assert(Number(data.preco) === 89.9, `preco=${data.preco}`);
    return `nome ok · preco=${data.preco} · comissao=${data.comissao}`;
  });

  await check('UPDATE (métricas e status) recalcula o score', async () => {
    const novas = { gvm_max: 500000, videos_criadores: 500, quantidade_criadores: 200 };
    const { data, error } = await adminClient
      .from('products')
      .update({ ...novas, max_score: null, status: 'em_alta' })
      .eq('id', produtoId)
      .select('max_score, status, updated_at')
      .single();
    if (error) throw new Error(error.message);
    assert(Number(data.max_score) === 100, `max_score=${data.max_score}, esperado 100`);
    assert(data.status === 'em_alta', `status=${data.status}`);
    return `max_score=100 · status=em_alta`;
  });

  await check('listagem com filtros e ordenação (página de produtos)', async () => {
    const { data, count, error } = await adminClient
      .from('products')
      .select('*', { count: 'exact' })
      .eq('pais', 'BR')
      .order('max_score', { ascending: false, nullsFirst: false })
      .range(0, 11);
    if (error) throw new Error(error.message);
    assert(Array.isArray(data), 'não retornou lista');
    return `${count} produto(s) BR · ${data.length} na página`;
  });

  await check('consultas do dashboard rodam sem erro', async () => {
    const desdeHoje = startOfTodayISO();
    const [total, hoje, emAlta] = await Promise.all([
      adminClient.from('products').select('id', { head: true, count: 'exact' }),
      adminClient
        .from('products')
        .select('id', { head: true, count: 'exact' })
        .gte('created_at', desdeHoje),
      adminClient
        .from('products')
        .select('id', { head: true, count: 'exact' })
        .eq('status', 'em_alta'),
    ]);
    for (const [nome, r] of Object.entries({ total, hoje, emAlta })) {
      if (r.error) throw new Error(`${nome}: ${r.error.message}`);
    }
    return `total=${total.count} · hoje=${hoje.count} · em_alta=${emAlta.count}`;
  });

  // -------------------------------------------------------------------------
  group('4. Usuário comum');
  await check('usuário comum faz login', async () => {
    if (USER_EMAIL && USER_PASSWORD) {
      userClient = createClient(URL_SUPABASE, ANON_KEY);
      const { data, error } = await userClient.auth.signInWithPassword({
        email: USER_EMAIL,
        password: USER_PASSWORD,
      });
      if (error) throw new Error(`${error.name}: ${error.message}`);
      userId = data.user.id;
      tempUserEmail = null;
      return `${USER_EMAIL} (informado por você)`;
    }

    if (NO_SIGNUP) skip('informe USER_EMAIL/USER_PASSWORD para validar permissões');

    const emailTemporario = `buscador-max-validacao-${Date.now()}@exemplo.com`;
    userClient = createClient(URL_SUPABASE, ANON_KEY);
    const { data, error } = await userClient.auth.signUp({
      email: emailTemporario,
      password: `Valida!${Date.now()}`,
      options: { data: { nome: 'Usuário de Validação' } },
    });
    if (error) throw new Error(`signUp: ${error.message}`);
    if (!data.session) {
      skip(
        'o projeto exige confirmação de e-mail. Confirme o usuário ou desative ' +
          '"Confirm email" em Authentication > Sign In / Providers.',
      );
    }
    userId = data.user.id;
    tempUserEmail = emailTemporario;
    return `${emailTemporario} (temporário — remova depois em Authentication > Users)`;
  });

  if (userClient && userId) {
    await check('perfil do usuário comum foi criado com role=user', async () => {
      const { data, error } = await userClient
        .from('users')
        .select('role, nome')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) {
        throw new Error(
          'o trigger on_auth_user_created não criou o perfil. ' +
            'Confira se ele existe: select * from pg_trigger where tgname = \'on_auth_user_created\';',
        );
      }
      assert(data.role === 'user', `role='${data.role}', esperado 'user'`);
      return `role=user · nome=${data.nome}`;
    });

    await check('vê a base de produtos (SELECT liberado)', async () => {
      const { count, error } = await userClient
        .from('products')
        .select('id', { head: true, count: 'exact' });
      if (error) throw new Error(error.message);
      assert(count > 0, 'a base está vazia — rode o seed.sql ou cadastre produtos');
      return `${count} produto(s) visíveis`;
    });

    await check('não consegue CREATE de produto', async () => {
      const { error } = await userClient
        .from('products')
        .insert({ nome: `${NOME_TESTE}_invasao`, categoria: 'Outros', pais: 'BR' });
      assert(
        error && (error.code === '42501' || /row-level security/i.test(error.message)),
        `esperava bloqueio de RLS, veio: ${error ? `${error.code} ${error.message}` : 'INSERIU!'}`,
      );
      return `bloqueado (${error.code})`;
    });

    await check('não consegue UPDATE de produto', async () => {
      const { data, error } = await userClient
        .from('products')
        .update({ nome: 'hackeado' })
        .eq('id', produtoId)
        .select('id');
      if (error) throw new Error(`${error.code} ${error.message}`);
      assert(data.length === 0, 'o RLS deixou alterar o produto!');
      return '0 linhas afetadas (RLS escondeu a linha)';
    });

    await check('não consegue DELETE de produto', async () => {
      const { data, error } = await userClient
        .from('products')
        .delete()
        .eq('id', produtoId)
        .select('id');
      if (error) throw new Error(`${error.code} ${error.message}`);
      assert(data.length === 0, 'o RLS deixou excluir o produto!');
      return '0 linhas afetadas';
    });

    await check('não consegue se promover a admin', async () => {
      const { error } = await userClient
        .from('users')
        .update({ role: 'admin' })
        .eq('id', userId);
      assert(
        error && error.code === '42501',
        `esperava 42501, veio: ${error ? `${error.code} ${error.message}` : 'PROMOVEU!'}`,
      );
      const { data } = await userClient
        .from('users')
        .select('role')
        .eq('id', userId)
        .maybeSingle();
      assert(data, 'perfil não encontrado após a tentativa de escalação');
      assert(data.role === 'user', `role virou '${data.role}'!`);
      return 'bloqueado (42501) · role continua user';
    });

    await check('não consegue ler o perfil de outro usuário', async () => {
      const { data, error } = await userClient.from('users').select('id').eq('id', adminId);
      if (error) throw new Error(error.message);
      assert(data.length === 0, 'enxergou o perfil do admin!');
      return 'nenhuma linha visível';
    });

    await check('consegue atualizar o próprio nome', async () => {
      const { data, error } = await userClient
        .from('users')
        .update({ nome: 'Nome Atualizado pela Validação' })
        .eq('id', userId)
        .select('nome');
      if (error) throw new Error(`${error.code} ${error.message}`);
      assert(data[0]?.nome === 'Nome Atualizado pela Validação', 'não atualizou');
      return 'ok';
    });

    await check('favorita e desfavorita o próprio produto', async () => {
      const ins = await userClient
        .from('favorites')
        .insert({ user_id: userId, product_id: produtoId })
        .select('product_id');
      if (ins.error) throw new Error(`insert: ${ins.error.message}`);

      const leitura = await userClient.from('favorites').select('product_id');
      if (leitura.error) throw new Error(`select: ${leitura.error.message}`);
      assert(leitura.data.length === 1, `esperava 1 favorito, vieram ${leitura.data.length}`);

      const del = await userClient
        .from('favorites')
        .delete()
        .eq('user_id', userId)
        .eq('product_id', produtoId)
        .select('product_id');
      if (del.error) throw new Error(`delete: ${del.error.message}`);
      assert(del.data.length === 1, 'não removeu o favorito');
      return 'insert + select + delete ok';
    });

    await check('não consegue favoritar em nome de outro usuário', async () => {
      const { error } = await userClient
        .from('favorites')
        .insert({ user_id: adminId, product_id: produtoId });
      assert(
        error && error.code === '42501',
        `esperava 42501, veio: ${error ? `${error.code} ${error.message}` : 'INSERIU!'}`,
      );
      return 'bloqueado (42501)';
    });

    await check('não consegue remover favorito de outro usuário', async () => {
      const { data, error } = await userClient
        .from('favorites')
        .delete()
        .eq('user_id', adminId)
        .select('product_id');
      if (error) throw new Error(`${error.code} ${error.message}`);
      assert(data.length === 0, 'removeu favorito de outro usuário!');
      return '0 linhas afetadas';
    });
  }

  // -------------------------------------------------------------------------
  group('5. Limpeza');
  await check('DELETE do produto de teste (como admin)', async () => {
    if (!produtoId) skip('nada para limpar');
    const { data, error } = await adminClient
      .from('products')
      .delete()
      .eq('id', produtoId)
      .select('id');
    if (error) throw new Error(`${error.code} ${error.message}`);
    assert(data.length === 1, 'não excluiu');

    const { data: ainda } = await adminClient
      .from('products')
      .select('id')
      .eq('id', produtoId);
    assert(ainda.length === 0, 'o produto ainda existe');
    return 'produto removido';
  });

  if (adminClient) await adminClient.auth.signOut().catch(() => {});
  if (userClient) await userClient.auth.signOut().catch(() => {});
}

// ---------------------------------------------------------------------------
main()
  .catch((error) => {
    console.error('\n\x1b[31mFalha inesperada:\x1b[0m', error);
    process.exitCode = 1;
  })
  .finally(() => {
    const ok = results.filter((r) => r.status === 'ok').length;
    const fail = results.filter((r) => r.status === 'fail');
    const skipped = results.filter((r) => r.status === 'skip').length;

    console.log('\n' + '─'.repeat(62));
    console.log(
      `\x1b[1mResumo:\x1b[0m ${ok} ok · ${fail.length} falha(s) · ${skipped} pulado(s) · ${results.length} verificação(ões)`,
    );

    if (tempUserEmail) {
      console.log(
        `\n\x1b[33mLembrete:\x1b[0m o usuário temporário ${tempUserEmail} continua em ` +
          `Authentication > Users (a publishable key não consegue apagá-lo).`,
      );
    }

    if (fail.length) {
      console.log('\n\x1b[31mFalhas:\x1b[0m');
      for (const item of fail) console.log(`  • [${item.group}] ${item.label}: ${item.detail}`);
      process.exitCode = 1;
    } else {
      console.log('\n\x1b[32mIntegração validada.\x1b[0m');
    }
    console.log('');
  });

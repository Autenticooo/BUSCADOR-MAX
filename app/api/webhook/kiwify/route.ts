import { timingSafeEqual } from 'node:crypto';

import { NextResponse } from 'next/server';

import { parseKiwifyEvent, type KiwifyEvent } from '@/lib/kiwify';
import { createServiceClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
// Node.js explícito: a rota lê segredos de process.env em runtime e jamais
// pode ser empacotada para edge/client.
export const runtime = 'nodejs';

/**
 * POST /api/webhook/kiwify?token=<segredo do webhook>
 *
 * Webhook da Kiwify (Apps > Webhooks). A cada evento:
 *   - compra aprovada / assinatura renovada  → users.ativo = true
 *     (+ plano, assinatura_desde, kiwify_transaction_id)
 *   - reembolso / chargeback / assinatura cancelada / atrasada
 *                                            → users.ativo = false
 *
 * Segurança:
 *   - o token é exigido em TODA chamada (query ?token= ou header
 *     x-kiwify-token) e comparado em tempo constante com a env;
 *   - a variável de ambiente é lida SOMENTE aqui, em runtime, dentro do
 *     handler — jamais use um prefixo NEXT_PUBLIC_ para ela;
 *   - a escrita usa a service role (o chamador não tem sessão), então o
 *     caminho público continua 100% protegido pelo RLS — esta rota só
 *     mexe em `ativo` e nos campos de assinatura;
 *   - eventos irrelevantes (boleto gerado etc.) e compradores sem conta
 *     respondem 200 de propósito: a Kiwify não deve reenviar nem usar a
 *     resposta para forçar erro.
 */

/** Ping para conferir se a rota está no ar (não revela configuração). */
export async function GET() {
  return NextResponse.json({ ok: true, service: 'buscador-max kiwify webhook' });
}

export async function POST(request: Request) {
  // 1) token configurado? sem ele a rota falha FECHADA (401 não configurado
  //    seria mentira; aqui é erro do nosso lado → 500)
  const expectedToken = process.env.KIWIFY_WEBHOOK_TOKEN?.trim();
  if (!expectedToken) {
    console.error('[kiwify] segredo do webhook não definido nas variáveis de ambiente');
    return NextResponse.json(
      { ok: false, error: 'Webhook não configurado no servidor.' },
      { status: 500 },
    );
  }

  // 2) valida o token (query param é o padrão de uso documentado; o header
  //    é aceito como alternativa)
  const providedToken =
    new URL(request.url).searchParams.get('token') ??
    request.headers.get('x-kiwify-token') ??
    '';

  if (!safeTokenEqual(providedToken, expectedToken)) {
    console.warn('[kiwify] chamada rejeitada: token inválido');
    return NextResponse.json({ ok: false, error: 'Token inválido.' }, { status: 401 });
  }

  // 3) corpo
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Corpo da requisição não é um JSON válido.' },
      { status: 400 },
    );
  }

  const event = parseKiwifyEvent(payload);

  if (!event.email) {
    return NextResponse.json(
      { ok: false, error: 'Payload sem e-mail do comprador.' },
      { status: 400 },
    );
  }

  // 4) eventos que não mudam o acesso
  if (event.action === 'ignore') {
    console.info(
      `[kiwify] evento ignorado: ${event.eventType ?? event.orderStatus ?? 'desconhecido'} (${event.email})`,
    );
    return NextResponse.json({ ok: true, ignored: true });
  }

  // 5) banco com service role (sem sessão de usuário aqui)
  const supabase = createServiceClient();
  if (!supabase) {
    console.error('[kiwify] SUPABASE_SERVICE_ROLE_KEY ausente ou Supabase não configurado');
    return NextResponse.json(
      { ok: false, error: 'Webhook não configurado no servidor (service role).' },
      { status: 500 },
    );
  }

  // ilike = igualdade sem diferenciar maiúsculas (o e-mail do checkout pode
  // vir com caixa diferente do cadastro)
  const { data: user, error: findError } = await supabase
    .from('users')
    .select('id, ativo, role')
    .ilike('email', event.email)
    .maybeSingle();

  if (findError) {
    console.error('[kiwify] falha ao consultar usuário:', findError.message);
    return NextResponse.json(
      { ok: false, error: 'Falha ao consultar o usuário.' },
      { status: 502 },
    );
  }

  if (!user) {
    // O comprador ainda não criou a conta: nada a fazer agora. Quando ele se
    // cadastrar em /cadastro, a administração libera manualmente (ou o evento
    // é reenviado). Responder 200 evita reenvios infinitos da Kiwify.
    console.info(`[kiwify] comprador sem conta cadastrada: ${event.email}`);
    return NextResponse.json({ ok: true, matched: false });
  }

  // 6) aplica o efeito do evento
  const update = buildUpdate(event);
  const { error: updateError } = await supabase.from('users').update(update).eq('id', user.id);

  if (updateError) {
    console.error('[kiwify] falha ao atualizar usuário:', updateError.message);
    return NextResponse.json(
      { ok: false, error: 'Falha ao atualizar o usuário.' },
      { status: 502 },
    );
  }

  console.info(
    `[kiwify] ${event.eventType ?? event.orderStatus}: acesso ` +
      `${event.action === 'activate' ? 'LIBERADO' : 'BLOQUEADO'} para ${event.email}`,
  );

  return NextResponse.json({
    ok: true,
    matched: true,
    action: event.action === 'activate' ? 'ativado' : 'desativado',
  });
}

function buildUpdate(event: KiwifyEvent): Record<string, unknown> {
  if (event.action === 'deactivate') {
    return { ativo: false };
  }

  const update: Record<string, unknown> = {
    ativo: true,
    assinatura_desde: event.purchasedAt ?? new Date().toISOString(),
  };
  if (event.plano) update.plano = event.plano;
  if (event.transactionId) update.kiwify_transaction_id = event.transactionId;
  return update;
}

/** Comparação em tempo constante (evita vazamento por timing). */
function safeTokenEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

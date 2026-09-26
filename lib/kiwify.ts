// ============================================================================
// Parser dos eventos enviados pelo webhook da Kiwify
// ----------------------------------------------------------------------------
// A Kiwify (Apps > Webhooks) dispara um POST JSON a cada evento do produto.
// Triggers documentados: boleto_gerado, pix_gerado, carrinho_abandonado,
// compra_recusada, compra_aprovada, compra_reembolsada, chargeback,
// subscription_canceled, subscription_late, subscription_renewed.
//
// O payload é tolerante a variações: alguns campos chegam aninhados
// (Customer.email, Product.product_name) e o nome do evento pode vir em
// `webhook_event_type`. Na ausência dele, caímos no `order_status`.
// ============================================================================

/** o que o webhook deve fazer com a conta do comprador */
export type KiwifyAction = 'activate' | 'deactivate' | 'ignore';

export interface KiwifyEvent {
  action: KiwifyAction;
  /** gatilho cru informado pela Kiwify (webhook_event_type) */
  eventType: string | null;
  /** status do pedido (order_status) — usado como fallback */
  orderStatus: string | null;
  /** e-mail do comprador (normalizado: trim + minúsculas) */
  email: string | null;
  /** nome do produto/plano comprado */
  plano: string | null;
  /** data/hora da compra em ISO 8601 (null se não vier ou não der para ler) */
  purchasedAt: string | null;
  /** id da transação/pedido (order_id), se disponível */
  transactionId: string | null;
}

// libera o acesso
const ACTIVATE_TRIGGERS = new Set([
  'compra_aprovada',
  'subscription_renewed',
  'assinatura_renovada',
]);

// corta o acesso
const DEACTIVATE_TRIGGERS = new Set([
  'compra_reembolsada',
  'chargeback',
  'subscription_canceled',
  'assinatura_cancelada',
  'subscription_late',
  'assinatura_atrasada',
]);

// fallback por status do pedido quando o tipo do evento não vem no payload
const ACTIVATE_STATUSES = new Set(['paid', 'approved']);
const DEACTIVATE_STATUSES = new Set(['refunded', 'chargeback', 'canceled', 'cancelled']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const s = String(value).trim();
  return s === '' ? null : s;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    const s = str(value);
    if (s) return s;
  }
  return null;
}

/**
 * Aceita ISO 8601, 'YYYY-MM-DD HH:mm:ss' (formato do approved_date da Kiwify)
 * e 'DD/MM/YYYY[ HH:mm[:ss]]'. Devolve ISO ou null.
 */
function toIsoDate(value: unknown): string | null {
  const raw = str(value);
  if (!raw) return null;

  const brMatch = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(raw);
  if (brMatch) {
    const [, dd, mm, yyyy, hh = '00', min = '00', ss = '00'] = brMatch;
    const date = new Date(Date.UTC(+yyyy, +mm - 1, +dd, +hh, +min, +ss));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  // 'YYYY-MM-DD HH:mm:ss' → ISO explícito em UTC
  const normalized = /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}/.test(raw) ? `${raw.replace(' ', 'T')}Z` : raw;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function detectAction(eventType: string | null, orderStatus: string | null): KiwifyAction {
  const type = (eventType ?? '').toLowerCase();
  if (ACTIVATE_TRIGGERS.has(type)) return 'activate';
  if (DEACTIVATE_TRIGGERS.has(type)) return 'deactivate';
  if (type) return 'ignore'; // evento conhecido fora da nossa lista (boleto_gerado etc.)

  const status = (orderStatus ?? '').toLowerCase();
  if (ACTIVATE_STATUSES.has(status)) return 'activate';
  if (DEACTIVATE_STATUSES.has(status)) return 'deactivate';
  return 'ignore';
}

/** Interpreta o corpo do webhook. Nunca lança: payload estranho vira "ignore". */
export function parseKiwifyEvent(payload: unknown): KiwifyEvent {
  const body = isRecord(payload) ? payload : {};
  const customer = isRecord(body.Customer) ? body.Customer : isRecord(body.customer) ? body.customer : null;
  const buyer = isRecord(body.buyer) ? body.buyer : null;
  const product = isRecord(body.Product) ? body.Product : isRecord(body.product) ? body.product : null;
  const subscription = isRecord(body.Subscription) ? body.Subscription : isRecord(body.subscription) ? body.subscription : null;
  const plan = isRecord(subscription?.plan) ? subscription?.plan : isRecord(body.plan) ? body.plan : null;

  const eventType = firstString(body.webhook_event_type, body.event_type, body.event);
  const orderStatus = firstString(body.order_status, body.status);

  const rawEmail = firstString(customer?.email, buyer?.email, body.email);
  const email = rawEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)
    ? rawEmail.toLowerCase()
    : null;

  return {
    action: detectAction(eventType, orderStatus),
    eventType,
    orderStatus,
    email,
    plano: firstString(product?.product_name, plan?.name, body.product_name),
    purchasedAt:
      toIsoDate(body.approved_date) ??
      toIsoDate(body.paid_at) ??
      toIsoDate(body.renewed_at) ??
      toIsoDate(body.created_at),
    transactionId: firstString(
      body.order_id,
      body.transaction_id,
      body.payment_merchant_id,
      body.subscription_id,
    ),
  };
}

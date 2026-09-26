import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

/**
 * POST /api/webhook/kiwify
 *
 * - exige KIWIFY_WEBHOOK_TOKEN (401 sem o token certo, 500 sem configuração)
 * - compra aprovada / renovada  → users.ativo = true + dados da compra
 * - reembolso / cancelada / atrasada → users.ativo = false
 * - evento ignorado / comprador sem conta → 200 sem escrita
 */
const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  ilike: vi.fn(),
  maybeSingle: vi.fn(),
  update: vi.fn(),
  updateEq: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({ createServiceClient: mocks.createServiceClient }));

import { GET, POST } from '@/app/api/webhook/kiwify/route';

const TOKEN = 'token-super-secreto-de-teste';

function kiwifyRequest(body: unknown, token: string | null = TOKEN) {
  const query = token !== null ? `?token=${encodeURIComponent(token)}` : '';
  return new Request(`http://localhost:3000/api/webhook/kiwify${query}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const COMPRA = {
  webhook_event_type: 'compra_aprovada',
  order_id: 'ord_123',
  order_status: 'paid',
  approved_date: '2026-09-20 14:32:10',
  Product: { product_name: 'BUSCADOR MAX — Assinatura Mensal' },
  Customer: { email: 'cliente@exemplo.com' },
};

const savedEnv = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.KIWIFY_WEBHOOK_TOKEN = TOKEN;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key-de-teste';

  mocks.updateEq.mockResolvedValue({ error: null });
  mocks.update.mockReturnValue({ eq: mocks.updateEq });
  mocks.maybeSingle.mockResolvedValue({
    data: { id: 'user-1', ativo: false, role: 'user' },
    error: null,
  });
  mocks.ilike.mockReturnValue({ maybeSingle: mocks.maybeSingle });
  mocks.select.mockReturnValue({ ilike: mocks.ilike });
  mocks.from.mockReturnValue({ select: mocks.select, update: mocks.update });
  mocks.createServiceClient.mockReturnValue({ from: mocks.from });
});

afterEach(() => {
  process.env = { ...savedEnv };
});

describe('GET (ping)', () => {
  it('responde ok sem validar token', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });
});

describe('POST — validação do token', () => {
  it('rejeita chamada sem token (401) e nem toca no banco', async () => {
    const res = await POST(kiwifyRequest(COMPRA, null));

    expect(res.status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('rejeita token errado (401)', async () => {
    const res = await POST(kiwifyRequest(COMPRA, 'token-errado'));

    expect(res.status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('aceita o token também pelo header x-kiwify-token', async () => {
    const request = new Request('http://localhost:3000/api/webhook/kiwify', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-kiwify-token': TOKEN },
      body: JSON.stringify(COMPRA),
    });

    const res = await POST(request);
    expect(res.status).toBe(200);
  });

  it('falha fechada (500) quando KIWIFY_WEBHOOK_TOKEN não está configurado', async () => {
    delete process.env.KIWIFY_WEBHOOK_TOKEN;

    const res = await POST(kiwifyRequest(COMPRA));

    expect(res.status).toBe(500);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('falha (500) quando a service role não está configurada', async () => {
    mocks.createServiceClient.mockReturnValue(null);

    const res = await POST(kiwifyRequest(COMPRA));

    expect(res.status).toBe(500);
  });
});

describe('POST — eventos', () => {
  it('compra aprovada: ativa a conta e grava plano/data/transação', async () => {
    const res = await POST(kiwifyRequest(COMPRA));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true, matched: true, action: 'ativado' });

    // buscou o usuário pelo e-mail (case-insensitive)
    expect(mocks.ilike).toHaveBeenCalledWith('email', 'cliente@exemplo.com');

    expect(mocks.update).toHaveBeenCalledWith({
      ativo: true,
      assinatura_desde: '2026-09-20T14:32:10.000Z',
      plano: 'BUSCADOR MAX — Assinatura Mensal',
      kiwify_transaction_id: 'ord_123',
    });
    expect(mocks.updateEq).toHaveBeenCalledWith('id', 'user-1');
  });

  it('assinatura renovada mantém o acesso', async () => {
    const res = await POST(
      kiwifyRequest({ ...COMPRA, webhook_event_type: 'subscription_renewed' }),
    );

    expect(res.status).toBe(200);
    expect((await res.json()).action).toBe('ativado');
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ ativo: true }),
    );
  });

  it.each(['compra_reembolsada', 'subscription_canceled', 'subscription_late'])(
    '%s: desativa a conta',
    async (tipo) => {
      const res = await POST(kiwifyRequest({ ...COMPRA, webhook_event_type: tipo }));

      expect(res.status).toBe(200);
      expect((await res.json()).action).toBe('desativado');
      expect(mocks.update).toHaveBeenCalledWith({ ativo: false });
    },
  );

  it('evento sem efeito (boleto gerado): 200, ignored, sem escrita', async () => {
    const res = await POST(kiwifyRequest({ ...COMPRA, webhook_event_type: 'boleto_gerado' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true, ignored: true });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('comprador sem conta: 200, matched=false, sem escrita', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    const res = await POST(kiwifyRequest(COMPRA));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true, matched: false });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('payload sem e-mail do comprador → 400', async () => {
    const res = await POST(kiwifyRequest({ webhook_event_type: 'compra_aprovada' }));

    expect(res.status).toBe(400);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('corpo não-JSON → 400', async () => {
    const res = await POST(kiwifyRequest('isso não é json'));

    expect(res.status).toBe(400);
  });
});

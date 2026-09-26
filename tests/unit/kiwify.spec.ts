import { describe, expect, it } from 'vitest';

import { parseKiwifyEvent } from '@/lib/kiwify';

/**
 * Parser do payload da Kiwify: mapeia os gatilhos documentados para
 * ativar/desativar/ignorar e extrai e-mail, plano, data e transação de
 * payloads com formatos variados (Customer/Product aninhados, datas BR).
 */

const COMPRA = {
  webhook_event_type: 'compra_aprovada',
  order_id: '81o27298-caa3-4080-a34d-e0e7eae94ab0',
  order_status: 'paid',
  approved_date: '2026-09-20 14:32:10',
  Product: { product_id: 'abc', product_name: 'BUSCADOR MAX — Assinatura Mensal' },
  Customer: { email: 'Cliente@Exemplo.com', full_name: 'Cliente Exemplo' },
};

describe('parseKiwifyEvent — mapeamento de eventos', () => {
  it('compra aprovada → activate, com plano/data/transação', () => {
    const event = parseKiwifyEvent(COMPRA);

    expect(event.action).toBe('activate');
    expect(event.eventType).toBe('compra_aprovada');
    expect(event.email).toBe('cliente@exemplo.com'); // normalizado
    expect(event.plano).toBe('BUSCADOR MAX — Assinatura Mensal');
    expect(event.purchasedAt).toBe('2026-09-20T14:32:10.000Z');
    expect(event.transactionId).toBe('81o27298-caa3-4080-a34d-e0e7eae94ab0');
  });

  it.each([
    ['assinatura renovada (docs)', 'subscription_renewed', 'activate'],
    ['assinatura renovada (pt)', 'assinatura_renovada', 'activate'],
    ['reembolso', 'compra_reembolsada', 'deactivate'],
    ['chargeback', 'chargeback', 'deactivate'],
    ['assinatura cancelada (docs)', 'subscription_canceled', 'deactivate'],
    ['assinatura cancelada (pt)', 'assinatura_cancelada', 'deactivate'],
    ['assinatura atrasada (docs)', 'subscription_late', 'deactivate'],
    ['assinatura atrasada (pt)', 'assinatura_atrasada', 'deactivate'],
    ['boleto gerado', 'boleto_gerado', 'ignore'],
    ['pix gerado', 'pix_gerado', 'ignore'],
    ['carrinho abandonado', 'carrinho_abandonado', 'ignore'],
    ['compra recusada', 'compra_recusada', 'ignore'],
  ])('%s (%s) → %s', (_label, tipo, esperado) => {
    expect(parseKiwifyEvent({ ...COMPRA, webhook_event_type: tipo }).action).toBe(esperado);
  });

  it('sem webhook_event_type, cai no order_status', () => {
    expect(
      parseKiwifyEvent({ ...COMPRA, webhook_event_type: undefined, order_status: 'paid' }).action,
    ).toBe('activate');
    expect(
      parseKiwifyEvent({ ...COMPRA, webhook_event_type: undefined, order_status: 'refunded' }).action,
    ).toBe('deactivate');
    expect(
      parseKiwifyEvent({ ...COMPRA, webhook_event_type: undefined, order_status: 'waiting_payment' }).action,
    ).toBe('ignore');
  });
});

describe('parseKiwifyEvent — tolerância do payload', () => {
  it('aceita email em caminhos alternativos', () => {
    expect(parseKiwifyEvent({ ...COMPRA, Customer: undefined, customer: { email: 'A@B.COM' } }).email)
      .toBe('a@b.com');
    expect(parseKiwifyEvent({ ...COMPRA, Customer: undefined, buyer: { email: 'c@d.com' } }).email)
      .toBe('c@d.com');
    expect(
      parseKiwifyEvent({ ...COMPRA, Customer: undefined, email: 'e@f.com' }).email,
    ).toBe('e@f.com');
  });

  it('rejeita e-mail inválido (a rota responde 400)', () => {
    expect(parseKiwifyEvent({ ...COMPRA, Customer: { email: 'sem-arroba' } }).email).toBeNull();
    expect(parseKiwifyEvent({}).email).toBeNull();
  });

  it('lê data em formato brasileiro DD/MM/YYYY HH:mm:ss', () => {
    const event = parseKiwifyEvent({ ...COMPRA, approved_date: '20/09/2026 14:32:10' });
    expect(event.purchasedAt).toBe('2026-09-20T14:32:10.000Z');
  });

  it('data ilegível vira null (a rota usa o horário atual)', () => {
    const event = parseKiwifyEvent({ ...COMPRA, approved_date: 'ontem de manhã' });
    expect(event.purchasedAt).toBeNull();
  });

  it('payload malformado não lança erro: vira ignore sem e-mail', () => {
    expect(parseKiwifyEvent(null).action).toBe('ignore');
    expect(parseKiwifyEvent('texto').email).toBeNull();
    expect(parseKiwifyEvent([1, 2, 3]).transactionId).toBeNull();
  });

  it('transação pode vir como número', () => {
    const event = parseKiwifyEvent({ ...COMPRA, order_id: 123456 });
    expect(event.transactionId).toBe('123456');
  });
});

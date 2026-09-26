# Integração Kiwify — liberação automática de acesso

O webhook da Kiwify liga e desliga o acesso dos assinantes sem intervenção
manual, usando o mesmo campo `public.users.ativo` do paywall.

```
Kiwify (pagamento) ──POST JSON──> /api/webhook/kiwify?token=*** ──> public.users
                                   (valida o token)                 ativo true/false
```

## 1. O que cada evento faz

| Evento Kiwify | Trigger no painel | Efeito na conta do comprador |
| --- | --- | --- |
| Compra aprovada | `compra_aprovada` | `ativo = true` + grava `plano`, `assinatura_desde`, `kiwify_transaction_id` |
| Assinatura renovada | `subscription_renewed` | mantém/reativa `ativo = true` e atualiza os dados da compra |
| Reembolso | `compra_reembolsada` | `ativo = false` |
| Chargeback | `chargeback` | `ativo = false` |
| Assinatura cancelada | `subscription_canceled` | `ativo = false` |
| Assinatura atrasada | `subscription_late` | `ativo = false` |
| Demais eventos (boleto/PIX gerado, carrinho abandonado, compra recusada…) | — | ignorados (resposta `200 { ok, ignored: true }`) |

Observações importantes:

- **O usuário é localizado pelo e-mail** do comprador (`Customer.email`,
  comparação sem diferenciar maiúsculas/minúsculas). Se não houver conta em
  `public.users`, o webhook responde `200 { ok, matched: false }` e **não cria
  usuário**: o comprador precisa se cadastrar em `/cadastro` com o mesmo
  e-mail da compra. Depois do cadastro, basta a administração liberar
  manualmente (SQL Editor) ou reenviar o evento pelo painel da Kiwify.
- **`role = 'admin'` continua com acesso** independente do `ativo` — mas se um
  admin também for cliente e o e-mail dele receber um reembolso, o webhook
  altera o campo normalmente.
- As alterações são **idempotentes**: reenviar o mesmo evento não gera erro
  nem efeito colateral (a Kiwify reenvia quando não recebe 2xx).

## 2. Configuração passo a passo

### 2.1 Aplicar a migration 0003

No Supabase: **SQL Editor → New query**, cole `supabase/migrations/0003_kiwify.sql`
e execute. Ela cria as colunas de assinatura e estende a trava que impede o
usuário de alterar os próprios dados de assinatura.

### 2.2 Variáveis de ambiente

No `.env.local` (e nas variáveis do deploy — Netlify, Vercel, etc.):

```env
# Supabase > Project Settings > API > service_role (chave SECRETA do servidor)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

# Inventado por você — será cadastrado no painel da Kiwify
KIWIFY_WEBHOOK_TOKEN=gere-uma-string-longa-e-aleatoria
```

Gere o token, por exemplo, com `openssl rand -hex 32` ou `node -e "console.log(crypto.randomUUID()+crypto.randomUUID())"`.

> **Nunca** commite esses valores. A service role **bypassa o RLS** — ela só
> existe no servidor e só é usada por esta rota.

### 2.3 Cadastrar o webhook na Kiwify

No painel Kiwify: **Apps → Webhooks → Criar webhook**:

- **Nome:** `BUSCADOR MAX — liberação de acesso`
- **URL do webhook:**
  `https://SEU-DOMINIO/api/webhook/kiwify?token=<KIWIFY_WEBHOOK_TOKEN>`
- **Produtos:** o produto/plano da assinatura (ou todos)
- **Eventos:** Compra aprovada, Reembolso, Chargeback, Assinatura cancelada,
  Assinatura atrasada, Assinatura renovada
- **Token:** o mesmo valor de `KIWIFY_WEBHOOK_TOKEN`

O endpoint aceita o token pela query string `?token=` (padrão acima) ou pelo
header `x-kiwify-token`.

### 2.4 Conferir

`GET /api/webhook/kiwify` responde `{"ok":true,"service":"buscador-max kiwify webhook"}`
— útil para confirmar que a rota está no ar (não valida token; o POST real
sempre valida).

## 3. Testes locais com curl

```bash
# ativar (simula "compra aprovada")
curl -X POST "http://localhost:3000/api/webhook/kiwify?token=SEU_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "webhook_event_type": "compra_aprovada",
    "order_id": "ord_teste_123",
    "order_status": "paid",
    "approved_date": "2026-09-26 14:00:00",
    "Product":  { "product_name": "BUSCADOR MAX — Assinatura Mensal" },
    "Customer": { "email": "cliente@exemplo.com" }
  }'

# desativar (simula "assinatura cancelada")
curl -X POST "http://localhost:3000/api/webhook/kiwify?token=SEU_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "webhook_event_type": "subscription_canceled",
    "order_id": "ord_teste_123",
    "Customer": { "email": "cliente@exemplo.com" }
  }'
```

Respostas possíveis:

| HTTP | Corpo | Significado |
| --- | --- | --- |
| 200 | `{ ok: true, matched: true, action: "ativado" \| "desativado" }` | usuário encontrado e atualizado |
| 200 | `{ ok: true, matched: false }` | comprador sem conta — nada feito |
| 200 | `{ ok: true, ignored: true }` | evento sem efeito sobre acesso |
| 400 | `{ ok: false, error: "…" }` | JSON inválido ou payload sem e-mail |
| 401 | `{ ok: false, error: "Token inválido." }` | token ausente/errado (nada foi gravado) |
| 500 | `{ ok: false, error: "Webhook não configurado…" }` | falta `KIWIFY_WEBHOOK_TOKEN` ou `SUPABASE_SERVICE_ROLE_KEY` |

## 4. Segurança

- O token é comparado em **tempo constante** (`crypto.timingSafeEqual`).
- Sem token configurado, a rota **falha fechada** (500, nada é gravado).
- A service role só escreve via esta rota; o restante do app segue 100% sob
  RLS. A trigger `users_protect_role_ativo` (migration 0003) impede que o
  próprio usuário altere `ativo`, `role` e os campos de assinatura.
- O middleware de sessão não intercepta o webhook: rotas `/api/*` são
  liberadas de qualquer redirect (nem para `/login` sem sessão, nem para
  `/dashboard` com sessão), então a Kiwify sempre recebe a resposta HTTP
  direta do endpoint.

# BUSCADOR MAX

SaaS interno (área de membros) para assinantes encontrarem produtos **TikTok Shop** em
potencial a partir de métricas reais: **GVM Max**, **vídeos de criadores**,
**criadores ativos** e **MAX SCORE**.

Sem landing page e sem página de vendas — o que existe é o sistema logado.

- **Frontend:** Next.js 16 (App Router) + React 19 + Tailwind CSS 4 + TypeScript
- **Backend:** Supabase (PostgreSQL + Auth + Row Level Security)
- **Acesso ao banco:** somente via Supabase com a **anon key**; toda a regra de
  permissão mora nas políticas RLS do Postgres.

---

## 1. Telas

| Rota | Acesso | O que faz |
| --- | --- | --- |
| `/login` | público | E-mail + senha → dashboard |
| `/dashboard` | assinante | Total de produtos, adicionados hoje, em alta, meus favoritos, produtos em alta e últimos cadastros |
| `/produtos` | assinante | Listagem em **tabela** ou **cards** com filtros |
| `/produtos/[id]` | assinante | Detalhe + botão “Abrir produto TikTok Shop” |
| `/favoritos` | assinante | Produtos salvos pelo usuário |
| `/perfil` | assinante | Nome, troca de senha, dados da assinatura |
| `/admin` | **admin** | Listagem gerencial com editar/excluir |
| `/admin/produtos/novo` | **admin** | Cadastro de produto |
| `/admin/produtos/[id]/editar` | **admin** | Edição de produto |

A raiz `/` redireciona direto para `/dashboard` (o middleware faz o mesmo).

### Filtros da listagem

Busca por nome/descrição/categoria · **categoria** · **país** · **status** ·
ordenação por **maior GVM Max**, **maior/menor MAX SCORE**, mais vídeos, mais
criadores, menor/maior preço e mais recentes. Os filtros ficam na URL, então a
página é compartilhável e a paginação preserva tudo.

---

## 2. MAX SCORE

Nota de 0 a 100 calculada **no banco** (função `public.calcular_max_score`),
disparada por trigger no insert/update quando o campo é enviado vazio:

| Componente | Peso | Teto de referência |
| --- | --- | --- |
| GVM Max | 40% | US$ 500.000 |
| Vídeos de criadores | 30% | 500 vídeos |
| Criadores ativos | 30% | 200 criadores |

O admin pode sobrescrever o valor preenchendo o campo **MAX SCORE** no cadastro;
deixando vazio, o banco calcula.

Faixas exibidas na interface: `80+ Explosivo` · `60+ Alto potencial` ·
`35+ Médio potencial` · `< 35 Baixo potencial`.

---

## 3. Instalação

```bash
npm install
cp .env.example .env.local   # e preencha com os dados do seu projeto
npm run dev
```

### 3.1 Variáveis

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

Enquanto elas não existirem, a aplicação mostra a tela **“Conecte seu projeto
Supabase”** em vez de fingir que funciona.

### 3.2 Banco

No Supabase: **SQL Editor → New query**, cole e execute nesta ordem:

1. `supabase/migrations/0001_init.sql` — tabelas, funções, triggers e RLS
2. `supabase/seed.sql` *(opcional)* — 20 produtos de exemplo

Ambos são **idempotentes** (podem rodar mais de uma vez).

### 3.3 Primeiro usuário e admin

1. **Authentication → Users → Add user** (e-mail + senha; desmarque
   “auto confirm” só se quiser exigir confirmação de e-mail).
2. Faça login uma vez na aplicação (isso cria a linha em `public.users`).
3. No **SQL Editor**:

```sql
update public.users set role = 'admin' where email = 'seu@email.com';
```

> Se o seu projeto não permitir trigger em `auth.users`, tudo bem: o login chama
> a RPC `public.ensure_profile()` como fallback e o perfil é criado do mesmo jeito.

### 3.4 Diagnóstico da integração

```
GET /api/health
```

Devolve o estado da conexão sem expor a chave:

```json
{
  "configured": true,
  "url": "https://xxxx.supabase.co",
  "keyFormat": "publishable (formato novo)",
  "status": "ok",
  "rest": { "reachable": true, "schema": "aplicado" },
  "auth": { "reachable": true },
  "hint": "Integração pronta: schema aplicado e RLS ativo."
}
```

Como ler `rest.schema`:

| valor | significado |
| --- | --- |
| `aplicado` | `public.products` existe — inclusive quando o RLS nega a leitura da anon key, que é o comportamento correto |
| `nao_aplicado` | o PostgREST não achou a relação: rode `0001_init.sql` |
| `inacessivel` | o servidor não alcançou o Supabase (URL errada, projeto pausado, ambiente sem egress) |

> **Chave `sb_publishable_…`:** o `@supabase/auth-js` só chama `decodeJWT()` sobre
> access tokens de sessão, nunca sobre a `apiKey` — ela viaja apenas no header
> `apikey`. O formato novo funciona sem adaptação. A `sb_secret_…` **não** deve ser
> usada aqui; o app inteiro roda com a publishable + RLS.

---

## 4. Banco de dados

### `public.users`
Perfil do assinante, 1:1 com `auth.users`.

| coluna | tipo | observação |
| --- | --- | --- |
| `id` | uuid PK | referencia `auth.users(id)` |
| `email` | text | |
| `nome` | text | |
| `role` | text | `user` \| `admin` |
| `ativo` | boolean | |
| `created_at` / `updated_at` | timestamptz | `updated_at` via trigger |

### `public.products`

`id`, `nome`, `imagem`, `categoria`, `descricao`, `link_tiktok`, `pais`, `preco`,
`comissao`, `gvm_max`, `videos_criadores`, `quantidade_criadores`, `max_score`,
`status`, `estrategia`, `created_at` (+ `updated_at`).

- `status`: `novo` | `ativo` | `em_alta` | `pausado` | `esgotado` (CHECK)
- `comissao` entre 0 e 100, valores numéricos não negativos (CHECK)
- índices em `categoria`, `pais`, `status`, `created_at desc`, `gvm_max desc`,
  `max_score desc` e `lower(nome)`

### `public.favorites`
`(user_id, product_id)` como chave primária — favoritar duas vezes não duplica.
Remover o produto ou o usuário limpa os favoritos (`on delete cascade`).

### Row Level Security (ativa nas três tabelas)

| Tabela | Anônimo | Assinante | Admin |
| --- | --- | --- | --- |
| `products` | nada | **SELECT** | SELECT + INSERT + UPDATE + DELETE |
| `users` | nada | vê e edita **só o próprio perfil** (nunca `role`/`ativo`) | vê e edita todos |
| `favorites` | nada | insere/lê/remove **só os próprios** | lê todos |

Detalhes importantes:

- `public.is_admin()` é `SECURITY DEFINER` para não recursar na RLS de `users`.
- `insert` em `public.users` só acontece pelo trigger em `auth.users` ou pela RPC
  `ensure_profile()` — não há política de insert para usuários.
- UPDATE/DELETE bloqueados pelo RLS **não geram erro**: o Postgres simplesmente não
  enxerga a linha. Por isso as Server Actions conferem quantas linhas foram afetadas
  e devolvem erro explícito quando o resultado é zero.

---

## 5. Estrutura

```
app/
  (app)/                  área logada (sidebar + topbar)
    dashboard/  produtos/  produtos/[id]/  favoritos/  perfil/
    admin/  admin/produtos/novo/  admin/produtos/[id]/editar/
  actions/                Server Actions (auth, products, favorites, profile)
  auth/callback/          troca de código do Supabase Auth
  login/                  tela de login
components/               UI (shell, filtros, cards, tabela, formulário, badges)
lib/                      supabase clients, sessão, consultas, score, validação
supabase/migrations/      schema + RLS
supabase/seed.sql         dados de exemplo
tests/                    vitest: banco/RLS (PGlite) + regras de negócio
```

---

## 6. Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | ambiente de desenvolvimento |
| `npm run build` | build de produção |
| `npm start` | servidor de produção |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | **64 testes**: 26 de schema/RLS em Postgres real (PGlite) + 38 de regras |

Os testes de banco (`tests/db`) sobem um Postgres de verdade em WASM, aplicam a
`0001_init.sql` e trocam de role (`anon` / `authenticated` + claim de usuário) para
provar que cada política se comporta como descrito acima — incluindo o disparo do
trigger de MAX SCORE e a execução do `seed.sql`.

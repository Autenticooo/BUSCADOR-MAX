import { z } from 'zod';

// ============================================================================
// Validação de entrada (Zod) — usada pelos Server Actions e formulários
// ============================================================================

const STATUSES = ['novo', 'ativo', 'em_alta', 'pausado', 'esgotado'] as const;
const SORTS = [
  'recentes',
  'gvm_desc',
  'score_desc',
  'score_asc',
  'videos_desc',
  'criadores_desc',
  'preco_asc',
  'preco_desc',
] as const;

/** '' (campo vazio do form) vira null antes de validar */
const emptyToNull = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? null : value;

const textOrNull = (max = 5000) =>
  z.preprocess(emptyToNull, z.union([z.string().trim().max(max), z.null()]));

const urlOrNull = z.preprocess(
  emptyToNull,
  z.union([z.url({ error: 'Informe uma URL válida (https://…)' }), z.null()]),
);

const money = z.coerce
  .number({ error: 'Valor inválido' })
  .min(0, 'Não pode ser negativo')
  .default(0);

const inteiro = z.coerce
  .number({ error: 'Valor inválido' })
  .int('Use apenas números inteiros')
  .min(0, 'Não pode ser negativo')
  .default(0);

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------
export const loginSchema = z.object({
  email: z.preprocess(
    (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
    z.email({ error: 'E-mail inválido' }),
  ),
  password: z.string({ error: 'Senha é obrigatória' }).min(1, 'Senha é obrigatória'),
});

// ---------------------------------------------------------------------------
// Produto (cadastro / edição do admin)
// ---------------------------------------------------------------------------
export const productSchema = z.object({
  nome: z
    .string({ error: 'Nome é obrigatório' })
    .trim()
    .min(2, 'Informe pelo menos 2 caracteres')
    .max(200, 'Máximo de 200 caracteres'),
  imagem: urlOrNull,
  categoria: z
    .string({ error: 'Categoria é obrigatória' })
    .trim()
    .min(1, 'Selecione a categoria')
    .max(60),
  descricao: textOrNull(),
  link_tiktok: urlOrNull,
  pais: z
    .string({ error: 'País é obrigatório' })
    .trim()
    .min(2, 'Selecione o país')
    .max(2),
  preco: money,
  comissao: z.coerce
    .number({ error: 'Valor inválido' })
    .min(0, 'Não pode ser negativa')
    .max(100, 'Máximo de 100%')
    .default(0),
  gvm_max: money,
  videos_criadores: inteiro,
  quantidade_criadores: inteiro,
  /**
   * null = o banco calcula automaticamente (trigger products_before_write).
   * IMPORTANTE: z.null() precisa vir ANTES do coerce — Number(null) === 0
   * faria o campo vazio virar 0 e inibiria o cálculo automático no banco.
   */
  max_score: z.preprocess(
    emptyToNull,
    z.union([
      z.null(),
      z.coerce
        .number({ error: 'Valor inválido' })
        .min(0, 'Entre 0 e 100')
        .max(100, 'Entre 0 e 100'),
    ]),
  ),
  status: z.enum(STATUSES, { error: 'Status inválido' }).default('ativo'),
  estrategia: textOrNull(),
});

export type ProductInput = z.infer<typeof productSchema>;

// ---------------------------------------------------------------------------
// Perfil
// ---------------------------------------------------------------------------
export const profileSchema = z.object({
  nome: z
    .string({ error: 'Nome é obrigatório' })
    .trim()
    .min(2, 'Informe pelo menos 2 caracteres')
    .max(80, 'Máximo de 80 caracteres'),
});

// ---------------------------------------------------------------------------
// Filtros da listagem (searchParams)
// ---------------------------------------------------------------------------
export const filtersSchema = z.object({
  q: z.string().trim().max(80).optional(),
  categoria: z.string().trim().max(60).optional(),
  pais: z.string().trim().length(2).optional(),
  status: z.enum(STATUSES).optional(),
  sort: z.enum(SORTS).optional(),
  page: z.coerce.number().int().min(1).max(1000).optional(),
});

export type FiltersInput = z.infer<typeof filtersSchema>;

// ---------------------------------------------------------------------------
// util
// ---------------------------------------------------------------------------
export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_form';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Converte FormData em objeto simples para o zod */
export function formDataToObject(formData: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) obj[key] = value;
  return obj;
}

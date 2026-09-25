import { filtersSchema, type FiltersInput } from './validators';
import type { ProductFilters } from './types';

// ============================================================================
// searchParams -> filtros tipados
// ============================================================================

type RawParams = Record<string, string | string[] | undefined>;

const FILTER_KEYS = ['q', 'categoria', 'pais', 'status', 'sort', 'page'] as const;

function firstValue(value: string | string[] | undefined): string | undefined {
  const text = Array.isArray(value) ? value[0] : value;
  return typeof text === 'string' && text.trim() !== '' ? text.trim() : undefined;
}

/**
 * Interpreta os searchParams da listagem.
 * Cada campo é validado individualmente: um parâmetro inválido é ignorado
 * sem derrubar os demais filtros.
 */
export function parseFilters(raw: RawParams): ProductFilters {
  const candidate: Record<string, unknown> = {};
  for (const key of FILTER_KEYS) {
    const value = firstValue(raw[key]);
    if (value !== undefined) candidate[key] = value;
  }

  const parsed = filtersSchema.safeParse(candidate);
  if (parsed.success) return parsed.data as ProductFilters;

  // fallback campo a campo
  const result: ProductFilters = {};
  for (const key of FILTER_KEYS) {
    if (!(key in candidate)) continue;
    const shape = filtersSchema.shape[key];
    if (!shape) continue;
    const fieldParsed = shape.safeParse(candidate[key]);
    if (fieldParsed.success) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (result as any)[key] = fieldParsed.data;
    }
  }
  return result;
}

/** Monta a URL da listagem preservando os filtros e trocando a página/visão */
export function buildProductHref(
  filters: ProductFilters & { view?: string },
  overrides: Record<string, string | number | undefined> = {},
  basePath = '/produtos',
): string {
  const params = new URLSearchParams();
  const merged = { ...filters, ...overrides };

  const entries: Array<[string, string | number | undefined]> = [
    ['q', merged.q],
    ['categoria', merged.categoria],
    ['pais', merged.pais],
    ['status', merged.status],
    ['sort', merged.sort],
    ['view', merged.view],
    ['page', merged.page],
  ];

  for (const [key, value] of entries) {
    if (value === undefined || value === '') continue;
    if (key === 'page' && Number(value) === 1) continue;
    if (key === 'sort' && value === 'recentes') continue;
    if (key === 'view' && value === 'tabela') continue;
    params.set(key, String(value));
  }

  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export type { FiltersInput };

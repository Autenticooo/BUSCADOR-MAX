import type { SupabaseClient } from '@supabase/supabase-js';

import { PAGE_SIZE } from './constants';
import { mapProducts } from './mappers';
import type {
  Product,
  ProductFilters,
  ProductPage,
  ProductSort,
} from './types';

// ============================================================================
// Camada de leitura de produtos (usado pelos Server Components)
// ============================================================================

export const SORT_MAP: Record<ProductSort, Array<{ column: string; ascending: boolean }>> = {
  recentes: [{ column: 'created_at', ascending: false }],
  gvm_desc: [
    { column: 'gvm_max', ascending: false },
    { column: 'created_at', ascending: false },
  ],
  score_desc: [
    { column: 'max_score', ascending: false },
    { column: 'gvm_max', ascending: false },
  ],
  score_asc: [
    { column: 'max_score', ascending: true },
    { column: 'gvm_max', ascending: false },
  ],
  videos_desc: [
    { column: 'videos_criadores', ascending: false },
    { column: 'max_score', ascending: false },
  ],
  criadores_desc: [
    { column: 'quantidade_criadores', ascending: false },
    { column: 'max_score', ascending: false },
  ],
  preco_asc: [{ column: 'preco', ascending: true }],
  preco_desc: [{ column: 'preco', ascending: false }],
};

/**
 * Remove caracteres que quebrariam o filtro `.or(nome.ilike.%x%)` do PostgREST.
 * ',' separa condições; '%' e '_' são curingas do LIKE; parênteses agrupam.
 */
export function sanitizeSearchTerm(term: string): string {
  return term
    .replace(/[%,_(),\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

/** Início do dia de hoje no fuso do negócio (padrão America/Sao_Paulo) */
export function startOfTodayISO(timeZone = 'America/Sao_Paulo'): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});

  return new Date(
    Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), 0, 0, 0),
  ).toISOString();
}

export interface FetchProductsOptions {
  perPage?: number;
  /** restringe o resultado a estes ids (usado na página de favoritos) */
  onlyIds?: string[];
}

export async function fetchProducts(
  client: SupabaseClient,
  filters: ProductFilters = {},
  options: FetchProductsOptions = {},
): Promise<ProductPage> {
  const perPage = options.perPage ?? PAGE_SIZE;
  const page = Math.max(1, filters.page ?? 1);

  // favoritos: sem ids não há o que listar
  if (options.onlyIds && options.onlyIds.length === 0) {
    return { products: [], total: 0, page, totalPages: 0, perPage };
  }

  let query = client.from('products').select('*', { count: 'exact' });

  if (options.onlyIds) query = query.in('id', options.onlyIds);

  const term = filters.q ? sanitizeSearchTerm(filters.q) : '';
  if (term) {
    const like = `%${term}%`;
    query = query.or(`nome.ilike.${like},descricao.ilike.${like},categoria.ilike.${like}`);
  }

  if (filters.categoria) query = query.eq('categoria', filters.categoria);
  if (filters.pais) query = query.eq('pais', filters.pais);
  if (filters.status) query = query.eq('status', filters.status);

  for (const { column, ascending } of SORT_MAP[filters.sort ?? 'recentes']) {
    query = query.order(column, { ascending, nullsFirst: false });
  }

  const from = (page - 1) * perPage;
  const { data, count, error } = await query.range(from, from + perPage - 1);

  if (error) {
    console.error('[fetchProducts]', error.message);
    return { products: [], total: 0, page, totalPages: 0, perPage };
  }

  const total = count ?? 0;
  return {
    products: mapProducts(data),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
    perPage,
  };
}

export async function fetchProductById(
  client: SupabaseClient,
  id: string,
): Promise<Product | null> {
  const { data, error } = await client.from('products').select('*').eq('id', id).maybeSingle();
  if (error) {
    console.error('[fetchProductById]', error.message);
    return null;
  }
  return data ? mapProducts([data])[0] : null;
}

export interface DashboardStats {
  total: number;
  hoje: number;
  emAlta: number;
  favoritos: number;
  /** produtos com status = em_alta, ordenados por MAX SCORE */
  emAltaList: Product[];
  topScore: Product[];
  recentes: Product[];
}

export async function fetchDashboardStats(
  client: SupabaseClient,
  userId: string,
): Promise<DashboardStats> {
  const desdeHoje = startOfTodayISO();

  const [total, hoje, emAlta, favoritos, emAltaList, topScore, recentes] = await Promise.all([
    client.from('products').select('id', { count: 'exact', head: true }),
    client
      .from('products')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', desdeHoje),
    client
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'em_alta'),
    client.from('favorites').select('product_id').eq('user_id', userId),
    client
      .from('products')
      .select('*')
      .eq('status', 'em_alta')
      .order('max_score', { ascending: false, nullsFirst: false })
      .limit(4),
    client
      .from('products')
      .select('*')
      .order('max_score', { ascending: false, nullsFirst: false })
      .limit(4),
    client.from('products').select('*').order('created_at', { ascending: false }).limit(6),
  ]);

  if (topScore.error) console.error('[stats:topScore]', topScore.error.message);
  if (emAltaList.error) console.error('[stats:emAltaList]', emAltaList.error.message);
  if (recentes.error) console.error('[stats:recentes]', recentes.error.message);
  if (total.error) console.error('[stats:total]', total.error.message);

  return {
    total: total.count ?? 0,
    hoje: hoje.count ?? 0,
    emAlta: emAlta.count ?? 0,
    favoritos: favoritos.data?.length ?? 0,
    emAltaList: mapProducts(emAltaList.data),
    topScore: mapProducts(topScore.data),
    recentes: mapProducts(recentes.data),
  };
}

/** ids dos produtos favoritados pelo usuário (para marcar a lista) */
export async function fetchFavoriteIds(
  client: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const { data, error } = await client
    .from('favorites')
    .select('product_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[fetchFavoriteIds]', error.message);
    return [];
  }
  return (data ?? []).map((row) => String(row.product_id));
}

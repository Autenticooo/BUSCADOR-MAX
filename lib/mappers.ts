import { toNumber } from './format';
import type { Product, ProductRow, UserProfile } from './types';

// ============================================================================
// Normalização das linhas que vêm do PostgREST
// ============================================================================

/**
 * Colunas `numeric` do Postgres podem chegar como string no JSON.
 * Aqui tudo vira number para a UI não precisar se preocupar.
 */
export function mapProduct(row: ProductRow | Record<string, unknown>): Product {
  const r = row as unknown as ProductRow;
  return {
    id: String(r.id),
    nome: String(r.nome ?? ''),
    imagem: (r.imagem as string | null) ?? null,
    categoria: (r.categoria as string | null) ?? null,
    descricao: (r.descricao as string | null) ?? null,
    link_tiktok: (r.link_tiktok as string | null) ?? null,
    pais: (r.pais as string | null) ?? null,
    preco: toNumber(r.preco),
    comissao: toNumber(r.comissao),
    gvm_max: toNumber(r.gvm_max),
    videos_criadores: Math.trunc(toNumber(r.videos_criadores)),
    quantidade_criadores: Math.trunc(toNumber(r.quantidade_criadores)),
    max_score: r.max_score === null || r.max_score === undefined ? null : toNumber(r.max_score),
    status: (r.status as Product['status']) ?? 'ativo',
    estrategia: (r.estrategia as string | null) ?? null,
    created_at: String(r.created_at ?? ''),
    updated_at: String(r.updated_at ?? ''),
  };
}

export function mapProducts(rows: unknown[] | null | undefined): Product[] {
  if (!rows) return [];
  return rows.map((row) => mapProduct(row as ProductRow));
}

export function mapProfile(row: Record<string, unknown> | null): UserProfile | null {
  if (!row) return null;
  return {
    id: String(row.id),
    email: String(row.email ?? ''),
    nome: (row.nome as string | null) ?? null,
    role: row.role === 'admin' ? 'admin' : 'user',
    // fail-closed: se o campo não vier por algum motivo, assume sem assinatura
    ativo: row.ativo === true,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  };
}

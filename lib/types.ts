// ============================================================================
// Tipos compartilhados do BUSCADOR MAX
// ============================================================================

export type UserRole = 'user' | 'admin';

export type ProductStatus = 'novo' | 'ativo' | 'em_alta' | 'pausado' | 'esgotado';

/** Perfil do assinante — tabela `public.users` */
export interface UserProfile {
  id: string;
  email: string;
  nome: string | null;
  role: UserRole;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

/** Produto TikTok Shop — tabela `public.products` */
export interface Product {
  id: string;
  nome: string;
  imagem: string | null;
  categoria: string | null;
  descricao: string | null;
  link_tiktok: string | null;
  pais: string | null;
  preco: number;
  comissao: number;
  gvm_max: number;
  videos_criadores: number;
  quantidade_criadores: number;
  max_score: number | null;
  status: ProductStatus;
  estrategia: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Linha crua devolvida pelo PostgREST.
 * Colunas `numeric` podem chegar como string dependendo da versão do PostgREST,
 * por isso os campos numéricos são aceitos nos dois formatos e normalizados
 * por `mapProduct()` (lib/mappers.ts).
 */
export type ProductRow = Omit<Product, 'preco' | 'comissao' | 'gvm_max' | 'max_score'> & {
  preco: number | string | null;
  comissao: number | string | null;
  gvm_max: number | string | null;
  max_score: number | string | null;
};

export type FavoriteRow = {
  user_id: string;
  product_id: string;
  created_at: string;
};

export type ProductSort =
  | 'recentes'
  | 'gvm_desc'
  | 'score_desc'
  | 'score_asc'
  | 'videos_desc'
  | 'criadores_desc'
  | 'preco_asc'
  | 'preco_desc';

export interface ProductFilters {
  q?: string;
  categoria?: string;
  pais?: string;
  status?: ProductStatus | '';
  sort?: ProductSort;
  page?: number;
}

export interface ProductPage {
  products: Product[];
  total: number;
  page: number;
  totalPages: number;
  perPage: number;
}

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

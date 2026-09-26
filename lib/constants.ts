import type { ProductStatus } from './types';

// ============================================================================
// Constantes de domínio
// ============================================================================

export const APP_NAME = 'BUSCADOR MAX';

/**
 * Mensagem do paywall exibida quando a conta existe mas não tem assinatura
 * ativa (users.ativo = false). Usada no login e na tela de bloqueio.
 * Fica FORA de app/actions/* porque módulos 'use server' só exportam funções.
 */
export const SUBSCRIPTION_REQUIRED_MESSAGE =
  'Sua conta ainda não possui uma assinatura ativa. É necessário ter uma assinatura ativa para acessar o BUSCADOR MAX. Assim que o pagamento for confirmado, a administração libera o seu acesso.';

/** Itens por página na listagem de produtos */
export const PAGE_SIZE = 12;

export const CATEGORIAS = [
  'Beleza e Cuidados',
  'Moda Feminina',
  'Moda Masculina',
  'Casa e Cozinha',
  'Eletrônicos',
  'Saúde',
  'Fitness',
  'Infantil',
  'Pet',
  'Acessórios',
  'Automotivo',
  'Outros',
] as const;

export const PAISES = [
  { code: 'BR', label: 'Brasil', currency: 'BRL', locale: 'pt-BR' },
  { code: 'US', label: 'Estados Unidos', currency: 'USD', locale: 'en-US' },
  { code: 'MX', label: 'México', currency: 'MXN', locale: 'es-MX' },
  { code: 'ID', label: 'Indonésia', currency: 'IDR', locale: 'id-ID' },
  { code: 'GB', label: 'Reino Unido', currency: 'GBP', locale: 'en-GB' },
  { code: 'MY', label: 'Malásia', currency: 'MYR', locale: 'ms-MY' },
  { code: 'TH', label: 'Tailândia', currency: 'THB', locale: 'th-TH' },
  { code: 'PH', label: 'Filipinas', currency: 'PHP', locale: 'en-PH' },
  { code: 'VN', label: 'Vietnã', currency: 'VND', locale: 'vi-VN' },
  { code: 'SG', label: 'Singapura', currency: 'SGD', locale: 'en-SG' },
] as const;

export const STATUS_LIST: Array<{
  value: ProductStatus;
  label: string;
  dot: string;
  badge: string;
}> = [
  {
    value: 'em_alta',
    label: 'Em alta',
    dot: 'bg-brand-lime',
    badge: 'bg-brand-lime/15 text-brand-lime border-brand-lime/30',
  },
  {
    value: 'novo',
    label: 'Novo',
    dot: 'bg-brand-cyan',
    badge: 'bg-brand-cyan/15 text-brand-cyan border-brand-cyan/30',
  },
  {
    value: 'ativo',
    label: 'Ativo',
    dot: 'bg-emerald-400',
    badge: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/30',
  },
  {
    value: 'pausado',
    label: 'Pausado',
    dot: 'bg-amber-400',
    badge: 'bg-amber-400/15 text-amber-300 border-amber-400/30',
  },
  {
    value: 'esgotado',
    label: 'Esgotado',
    dot: 'bg-rose-500',
    badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  },
];

export const STATUS_LABEL: Record<ProductStatus, string> = STATUS_LIST.reduce(
  (acc, s) => ({ ...acc, [s.value]: s.label }),
  {} as Record<ProductStatus, string>,
);

export const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'recentes', label: 'Mais recentes' },
  { value: 'score_desc', label: 'Maior MAX SCORE' },
  { value: 'score_asc', label: 'Menor MAX SCORE' },
  { value: 'gvm_desc', label: 'Maior GVM Max' },
  { value: 'videos_desc', label: 'Mais vídeos de criadores' },
  { value: 'criadores_desc', label: 'Mais criadores ativos' },
  { value: 'preco_asc', label: 'Menor preço' },
  { value: 'preco_desc', label: 'Maior preço' },
];

/** País padrão usado quando nenhum filtro é selecionado */
export function findPais(code: string | null | undefined) {
  return PAISES.find((p) => p.code === code);
}

import { findPais } from './constants';

// ============================================================================
// Formatação (pt-BR)
// ============================================================================

export function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

export function formatNumber(value: number | string | null | undefined, digits = 0): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(toNumber(value));
}

/** 1234567 -> "1,23 mi" | 12345 -> "12,3 mil" */
export function formatCompact(value: number | string | null | undefined): string {
  return new Intl.NumberFormat('pt-BR', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(toNumber(value));
}

/** Moeda conforme o país do produto (fallback BRL) */
export function formatMoney(
  value: number | string | null | undefined,
  paisCode?: string | null,
): string {
  const pais = findPais(paisCode);
  return new Intl.NumberFormat(pais?.locale ?? 'pt-BR', {
    style: 'currency',
    currency: pais?.currency ?? 'BRL',
    maximumFractionDigits: 2,
  }).format(toNumber(value));
}

export function formatPercent(value: number | string | null | undefined, digits = 1): string {
  return `${new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(toNumber(value))}%`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(date);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/** "há 3 dias" */
export function timeAgo(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  const diff = date.getTime() - Date.now();
  return new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' }).format(
    Math.round(diff / 86_400_000),
    'day',
  );
}

/** Trunca texto mantendo palavras inteiras */
export function truncate(text: string | null | undefined, max = 120): string {
  if (!text) return '';
  const clean = text.trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).replace(/\s+\S*$/, '')}…`;
}

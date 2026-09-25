// ============================================================================
// MAX SCORE
// ----------------------------------------------------------------------------
// Espelho em TypeScript de `public.calcular_max_score()` (supabase/migrations).
// A fonte da verdade é o banco: o MAX SCORE exibido vem da coluna max_score.
// Esta função existe para o preview em tempo real do formulário do admin.
//
//   GVM Max ............ 40 pontos  (teto: US$ 500.000)
//   Vídeos de criadores  30 pontos  (teto: 500 vídeos)
//   Criadores ativos ..... 30 pontos  (teto: 200 criadores)
// ============================================================================

export const SCORE_WEIGHTS = {
  gvm: 40,
  videos: 30,
  criadores: 30,
} as const;

export const SCORE_LIMITS = {
  gvm: 500_000,
  videos: 500,
  criadores: 200,
} as const;

const clamp01 = (n: number) => Math.min(Math.max(n || 0, 0), 1);

export function calcularMaxScore(input: {
  gvm_max?: number | string | null;
  videos_criadores?: number | string | null;
  quantidade_criadores?: number | string | null;
}): number {
  const gvm = Number(input.gvm_max ?? 0) || 0;
  const videos = Number(input.videos_criadores ?? 0) || 0;
  const criadores = Number(input.quantidade_criadores ?? 0) || 0;

  const raw =
    clamp01(gvm / SCORE_LIMITS.gvm) * SCORE_WEIGHTS.gvm +
    clamp01(videos / SCORE_LIMITS.videos) * SCORE_WEIGHTS.videos +
    clamp01(criadores / SCORE_LIMITS.criadores) * SCORE_WEIGHTS.criadores;

  return Math.round(raw * 100) / 100;
}

export type ScoreBand = {
  label: string;
  /** classes tailwind do badge */
  className: string;
  /** cor da barra de progresso */
  bar: string;
};

export function scoreBand(score: number | null | undefined): ScoreBand {
  const value = Number(score ?? 0) || 0;
  if (value >= 80)
    return {
      label: 'Explosivo',
      className: 'bg-brand-lime/15 text-brand-lime border-brand-lime/40',
      bar: 'bg-brand-lime',
    };
  if (value >= 60)
    return {
      label: 'Alto potencial',
      className: 'bg-brand-cyan/15 text-brand-cyan border-brand-cyan/40',
      bar: 'bg-brand-cyan',
    };
  if (value >= 35)
    return {
      label: 'Médio potencial',
      className: 'bg-amber-400/15 text-amber-300 border-amber-400/40',
      bar: 'bg-amber-400',
    };
  return {
    label: 'Baixo potencial',
    className: 'bg-white/5 text-slate-400 border-white/10',
    bar: 'bg-slate-500',
  };
}

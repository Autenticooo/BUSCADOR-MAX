import { scoreBand } from '@/lib/score';

/** Badge do MAX SCORE com barra de progresso 0-100 */
export function ScoreBadge({
  score,
  size = 'md',
}: {
  score: number | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  const value = Number(score ?? 0) || 0;
  const band = scoreBand(value);
  const width = `${Math.min(Math.max(value, 0), 100)}%`;

  const numberClass =
    size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-sm' : 'text-lg';

  return (
    <div
      className={`inline-flex flex-col gap-1.5 rounded-xl border px-3 py-2 ${band.className}`}
      title={`${band.label} — MAX SCORE ${value.toFixed(2)}/100`}
    >
      <span className="flex items-baseline gap-1.5">
        <span className={`font-black leading-none tabular-nums ${numberClass}`}>
          {value.toFixed(1)}
        </span>
        <span className="text-[10px] font-bold tracking-wider uppercase opacity-70">
          /100
        </span>
      </span>
      <span className="h-1 w-full min-w-20 overflow-hidden rounded-full bg-white/15">
        <span className={`block h-full rounded-full ${band.bar}`} style={{ width }} />
      </span>
    </div>
  );
}

/** Versão compacta para tabelas */
export function ScorePill({ score }: { score: number | null }) {
  const value = Number(score ?? 0) || 0;
  const band = scoreBand(value);
  return (
    <span className={`chip tabular-nums ${band.className}`}>
      <span className={`size-1.5 rounded-full ${band.bar}`} />
      {value.toFixed(1)}
    </span>
  );
}

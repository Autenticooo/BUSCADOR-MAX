import type { LucideIcon } from 'lucide-react';

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'cyan',
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone?: 'cyan' | 'lime' | 'pink' | 'violet';
}) {
  const tones: Record<string, string> = {
    cyan: 'from-brand-cyan/20 to-transparent text-brand-cyan',
    lime: 'from-brand-lime/20 to-transparent text-brand-lime',
    pink: 'from-brand-pink/20 to-transparent text-brand-pink',
    violet: 'from-violet-500/20 to-transparent text-violet-300',
  };

  return (
    <div className="panel relative overflow-hidden p-5">
      <div
        className={`pointer-events-none absolute -top-16 -right-10 size-40 rounded-full bg-gradient-to-br blur-2xl ${tones[tone]}`}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-wider text-slate-400 uppercase">
            {label}
          </p>
          <p className="mt-2 text-3xl font-black text-white tabular-nums">{value}</p>
          {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
        </div>
        <span
          className={`grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 ${tones[tone]}`}
        >
          <Icon className="size-5" />
        </span>
      </div>
    </div>
  );
}

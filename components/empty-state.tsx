import type { LucideIcon } from 'lucide-react';

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="panel flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-2xl border border-white/10 bg-white/5 text-slate-500">
        <Icon className="size-7" />
      </span>
      <h3 className="text-lg font-bold text-white">{title}</h3>
      {description ? (
        <p className="max-w-md text-sm text-slate-400">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

import { STATUS_LABEL, STATUS_LIST } from '@/lib/constants';
import type { ProductStatus } from '@/lib/types';

export function StatusBadge({ status }: { status: ProductStatus }) {
  const config = STATUS_LIST.find((item) => item.value === status);
  const className =
    config?.badge ?? 'bg-white/5 text-slate-400 border-white/10';
  const dot = config?.dot ?? 'bg-slate-400';

  return (
    <span className={`chip ${className}`}>
      <span className={`size-1.5 rounded-full ${dot}`} />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

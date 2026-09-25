import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export function Pagination({
  page,
  totalPages,
  total,
  buildHref,
}: {
  page: number;
  totalPages: number;
  total: number;
  /** monta a URL preservando os filtros atuais */
  buildHref: (page: number) => string;
}) {
  if (totalPages <= 1) {
    return (
      <p className="text-center text-xs text-slate-500 tabular-nums">
        {total} produto(s) encontrado(s)
      </p>
    );
  }

  const window = pagesAround(page, totalPages);

  return (
    <nav
      aria-label="Paginação"
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-xs text-slate-500 tabular-nums">
        Página <span className="font-bold text-slate-300">{page}</span> de{' '}
        <span className="font-bold text-slate-300">{totalPages}</span> · {total} produto(s)
      </p>

      <div className="flex items-center gap-1">
        <PageLink href={buildHref(page - 1)} disabled={page <= 1} ariaLabel="Página anterior">
          <ChevronLeft className="size-4" />
        </PageLink>

        {window.map((item, index) =>
          item === '…' ? (
            <span key={`gap-${index}`} className="px-2 text-slate-600">
              …
            </span>
          ) : (
            <PageLink
              key={item}
              href={buildHref(item)}
              active={item === page}
              ariaLabel={`Página ${item}`}
            >
              {item}
            </PageLink>
          ),
        )}

        <PageLink
          href={buildHref(page + 1)}
          disabled={page >= totalPages}
          ariaLabel="Próxima página"
        >
          <ChevronRight className="size-4" />
        </PageLink>
      </div>
    </nav>
  );
}

function PageLink({
  href,
  children,
  active,
  disabled,
  ariaLabel,
}: {
  href: string;
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  if (disabled) {
    return (
      <span className="grid size-9 place-items-center rounded-lg border border-white/5 text-slate-700">
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      aria-current={active ? 'page' : undefined}
      className={`grid size-9 place-items-center rounded-lg border text-sm font-semibold transition ${
        active
          ? 'border-brand-cyan/50 bg-brand-cyan/15 text-brand-cyan'
          : 'border-white/8 text-slate-300 hover:border-white/20 hover:bg-white/5'
      }`}
    >
      {children}
    </Link>
  );
}

function pagesAround(current: number, total: number): Array<number | '…'> {
  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);

  const result: Array<number | '…'> = [];
  sorted.forEach((page, index) => {
    if (index > 0 && page - (sorted[index - 1] as number) > 1) result.push('…');
    result.push(page);
  });
  return result;
}

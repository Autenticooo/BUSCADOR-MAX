'use client';

import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';

import { CATEGORIAS, PAISES, SORT_OPTIONS, STATUS_LIST } from '@/lib/constants';
import type { ProductFilters } from '@/lib/types';

export function ProductFilters({
  filters,
  basePath,
  resultCount,
}: {
  filters: ProductFilters;
  basePath: string;
  resultCount?: number;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  const hasFilters = Boolean(
    filters.q || filters.categoria || filters.pais || filters.status,
  );

  function submit() {
    formRef.current?.requestSubmit();
  }

  function limpar() {
    router.push(basePath);
  }

  return (
    <form
      ref={formRef}
      method="get"
      action={basePath}
      className="panel space-y-4 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const params = new URLSearchParams();
        for (const [key, value] of data.entries()) {
          const text = String(value).trim();
          if (text) params.set(key, text);
        }
        const query = params.toString();
        router.push(query ? `${basePath}?${query}` : basePath);
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xs font-bold tracking-wider text-slate-400 uppercase">
          <SlidersHorizontal className="size-4 text-brand-cyan" />
          Filtros
        </p>
        {typeof resultCount === 'number' ? (
          <p className="text-xs text-slate-500 tabular-nums">
            <span className="font-bold text-white">{resultCount}</span> produto(s)
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div className="xl:col-span-2">
          <label className="field-label" htmlFor="q">
            Busca
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" />
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={filters.q ?? ''}
              placeholder="Nome, categoria ou descrição…"
              className="field pl-9"
            />
          </div>
        </div>

        <div>
          <label className="field-label" htmlFor="categoria">
            Categoria
          </label>
          <select
            id="categoria"
            name="categoria"
            defaultValue={filters.categoria ?? ''}
            onChange={submit}
            className="field"
          >
            <option value="">Todas</option>
            {CATEGORIAS.map((categoria) => (
              <option key={categoria} value={categoria}>
                {categoria}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label" htmlFor="pais">
            País
          </label>
          <select
            id="pais"
            name="pais"
            defaultValue={filters.pais ?? ''}
            onChange={submit}
            className="field"
          >
            <option value="">Todos</option>
            {PAISES.map((pais) => (
              <option key={pais.code} value={pais.code}>
                {pais.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label" htmlFor="status">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={filters.status ?? ''}
            onChange={submit}
            className="field"
          >
            <option value="">Todos</option>
            {STATUS_LIST.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 border-t border-white/8 pt-4">
        <div className="w-full sm:w-64">
          <label className="field-label" htmlFor="sort">
            Ordenar por
          </label>
          <select
            id="sort"
            name="sort"
            defaultValue={filters.sort ?? 'recentes'}
            onChange={submit}
            className="field"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          {hasFilters ? (
            <button type="button" onClick={limpar} className="btn-ghost">
              <X className="size-4" />
              Limpar
            </button>
          ) : null}
          <button type="submit" className="btn-primary">
            <Search className="size-4" />
            Aplicar
          </button>
        </div>
      </div>
    </form>
  );
}

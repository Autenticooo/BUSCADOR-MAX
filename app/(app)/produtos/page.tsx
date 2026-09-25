import { LayoutGrid, PackageSearch, Table2 } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { ProductCard } from '@/components/product-card';
import { ProductFilters } from '@/components/product-filters';
import { ProductTable } from '@/components/product-table';
import { buildProductHref, parseFilters } from '@/lib/params';
import { fetchFavoriteIds, fetchProducts } from '@/lib/products';
import { requireProfile } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Produtos' };
export const dynamic = 'force-dynamic';

export default async function ProdutosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireProfile();

  const raw = await searchParams;
  const filters = parseFilters(raw);
  const view = raw.view === 'cards' ? 'cards' : 'tabela';

  const supabase = await createClient();
  const { data: session } = await supabase.auth.getUser();
  const userId = session.user?.id ?? '';

  const [result, favoriteIds] = await Promise.all([
    fetchProducts(supabase, filters),
    fetchFavoriteIds(supabase, userId),
  ]);

  const favorites = new Set(favoriteIds);

  return (
    <>
      <PageHeader
        title="Produtos"
        description="Base de produtos TikTok Shop com GVM Max, vídeos de criadores, criadores ativos e MAX SCORE."
      />

      <Suspense fallback={<div className="panel mb-4 h-40 animate-pulse" />}>
        <div className="mb-4">
          <ProductFilters
            filters={filters}
            basePath="/produtos"
            resultCount={result.total}
          />
        </div>
      </Suspense>

      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500 tabular-nums">
          {result.total} produto(s) · página {result.page} de {result.totalPages}
        </p>
        <ViewToggle
          view={view}
          hrefFor={(next) => buildProductHref({ ...filters, view: next }, { page: 1 })}
        />
      </div>

      {result.products.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title="Nenhum produto encontrado"
          description="Ajuste os filtros de categoria, país ou status — ou limpe a busca para ver toda a base."
        />
      ) : view === 'cards' ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {result.products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              favorited={favorites.has(product.id)}
            />
          ))}
        </div>
      ) : (
        <ProductTable products={result.products} favoriteIds={favorites} />
      )}

      <div className="mt-6">
        <Pagination
          page={result.page}
          totalPages={result.totalPages}
          total={result.total}
          buildHref={(page) => buildProductHref({ ...filters, view }, { page })}
        />
      </div>
    </>
  );
}

function ViewToggle({
  view,
  hrefFor,
}: {
  view: 'tabela' | 'cards';
  hrefFor: (view: 'tabela' | 'cards') => string;
}) {
  const options: Array<{ value: 'tabela' | 'cards'; label: string; icon: typeof Table2 }> = [
    { value: 'tabela', label: 'Tabela', icon: Table2 },
    { value: 'cards', label: 'Cards', icon: LayoutGrid },
  ];

  return (
    <div className="flex rounded-xl border border-white/10 bg-ink-900/70 p-1">
      {options.map(({ value, label, icon: Icon }) => (
        <Link
          key={value}
          href={hrefFor(value)}
          aria-pressed={view === value}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            view === value
              ? 'bg-brand-cyan/15 text-brand-cyan'
              : 'text-slate-400 hover:text-slate-100'
          }`}
        >
          <Icon className="size-3.5" />
          {label}
        </Link>
      ))}
    </div>
  );
}

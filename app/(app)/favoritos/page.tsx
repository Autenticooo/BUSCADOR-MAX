import { Star } from 'lucide-react';
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

export const metadata: Metadata = { title: 'Meus favoritos' };
export const dynamic = 'force-dynamic';

export default async function FavoritosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireProfile();
  const raw = await searchParams;
  const filters = parseFilters(raw);
  const view = raw.view === 'tabela' ? 'tabela' : 'cards';

  const supabase = await createClient();
  const favoriteIds = await fetchFavoriteIds(supabase, profile.id);

  const result = await fetchProducts(
    supabase,
    { ...filters, sort: filters.sort ?? 'score_desc' },
    { onlyIds: favoriteIds },
  );

  const favorites = new Set(favoriteIds);

  return (
    <>
      <PageHeader
        title="Meus favoritos"
        description="Produtos que você salvou para acompanhar. Somente você enxerga esta lista."
        actions={
          <Link href="/produtos" className="btn-secondary">
            <Star className="size-4" />
            Buscar mais produtos
          </Link>
        }
      />

      {favoriteIds.length === 0 ? (
        <EmptyState
          icon={Star}
          title="Você ainda não salvou nenhum produto"
          description="Use a estrela nos cards ou na tabela de produtos para guardar os que quiser acompanhar por aqui."
          action={
            <Link href="/produtos" className="btn-primary">
              Explorar produtos
            </Link>
          }
        />
      ) : (
        <>
          <Suspense fallback={<div className="panel mb-4 h-40 animate-pulse" />}>
            <div className="mb-4">
              <ProductFilters
                filters={filters}
                basePath="/favoritos"
                resultCount={result.total}
              />
            </div>
          </Suspense>

          {result.products.length === 0 ? (
            <EmptyState
              icon={Star}
              title="Nenhum favorito com esses filtros"
              description="Os filtros aplicados não bateram com nenhum produto salvo."
            />
          ) : view === 'tabela' ? (
            <ProductTable products={result.products} favoriteIds={favorites} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {result.products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  favorited={favorites.has(product.id)}
                />
              ))}
            </div>
          )}

          <div className="mt-6">
            <Pagination
              page={result.page}
              totalPages={result.totalPages}
              total={result.total}
              buildHref={(page) =>
                buildProductHref({ ...filters, view }, { page }, '/favoritos')
              }
            />
          </div>
        </>
      )}
    </>
  );
}

import {
  CalendarPlus,
  ExternalLink,
  Flame,
  Link2Off,
  Package,
  Pencil,
  Plus,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { DeleteProductButton } from '@/components/delete-product-button';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { ProductFilters } from '@/components/product-filters';
import { ProductImage } from '@/components/product-image';
import { ScorePill } from '@/components/score-badge';
import { StatCard } from '@/components/stat-card';
import { StatusBadge } from '@/components/status-badge';
import { findPais } from '@/lib/constants';
import { formatDate, formatMoney } from '@/lib/format';
import { buildProductHref, parseFilters } from '@/lib/params';
import { fetchProducts, startOfTodayISO } from '@/lib/products';
import { requireAdmin } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Administração' };
export const dynamic = 'force-dynamic';

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();

  const raw = await searchParams;
  const filters = parseFilters(raw);

  const supabase = await createClient();

  const [result, total, emAlta, hoje, semLink] = await Promise.all([
    fetchProducts(supabase, filters, { perPage: 20 }),
    supabase.from('products').select('id', { count: 'exact', head: true }),
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'em_alta'),
    supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', startOfTodayISO()),
    supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .or('link_tiktok.is.null,link_tiktok.eq.'),
  ]);

  return (
    <>
      <PageHeader
        title="Painel do administrador"
        description="Cadastro manual da base de produtos TikTok Shop. Apenas administradores enxergam esta área."
        actions={
          <Link href="/admin/produtos/novo" className="btn-primary">
            <Plus className="size-4" />
            Adicionar produto
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Produtos na base" value={total.count ?? 0} icon={Package} tone="cyan" />
        <StatCard label="Em alta" value={emAlta.count ?? 0} icon={Flame} tone="pink" />
        <StatCard label="Adicionados hoje" value={hoje.count ?? 0} icon={CalendarPlus} tone="violet" />
        <StatCard
          label="Sem link TikTok"
          value={semLink.count ?? 0}
          hint="Precisam de correção"
          icon={Link2Off}
          tone="lime"
        />
      </div>

      <div className="mt-6">
        <Suspense fallback={<div className="panel h-40 animate-pulse" />}>
          <ProductFilters filters={filters} basePath="/admin" resultCount={result.total} />
        </Suspense>
      </div>

      <div className="mt-4">
        {result.products.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Nenhum produto encontrado"
            description="Cadastre o primeiro produto ou ajuste os filtros da listagem."
            action={
              <Link href="/admin/produtos/novo" className="btn-primary">
                <Plus className="size-4" />
                Adicionar produto
              </Link>
            }
          />
        ) : (
          <div className="panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] border-collapse">
                <thead className="border-b border-white/8 bg-ink-900/60">
                  <tr>
                    <th className="th">Produto</th>
                    <th className="th">Categoria</th>
                    <th className="th">País</th>
                    <th className="th text-right">Preço</th>
                    <th className="th text-right">GVM Max</th>
                    <th className="th text-right">Vídeos</th>
                    <th className="th text-right">Criadores</th>
                    <th className="th text-center">MAX SCORE</th>
                    <th className="th">Status</th>
                    <th className="th">Cadastro</th>
                    <th className="th text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {result.products.map((product) => (
                    <tr key={product.id} className="transition hover:bg-white/3">
                      <td className="td">
                        <div className="flex min-w-56 items-center gap-3">
                          <ProductImage
                            src={product.imagem}
                            alt={product.nome}
                            className="size-10 shrink-0"
                          />
                          <div className="min-w-0">
                            <Link
                              href={`/produtos/${product.id}`}
                              className="line-clamp-1 font-semibold text-white hover:text-brand-cyan"
                            >
                              {product.nome}
                            </Link>
                            <p className="text-xs text-slate-500">
                              {product.link_tiktok ? (
                                <a
                                  href={product.link_tiktok}
                                  target="_blank"
                                  rel="noopener noreferrer nofollow"
                                  className="inline-flex items-center gap-1 hover:text-brand-cyan"
                                >
                                  <ExternalLink className="size-3" />
                                  TikTok Shop
                                </a>
                              ) : (
                                <span className="text-brand-pink">sem link</span>
                              )}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="td whitespace-nowrap text-slate-400">
                        {product.categoria ?? '—'}
                      </td>
                      <td className="td whitespace-nowrap text-slate-400">
                        {findPais(product.pais)?.label ?? '—'}
                      </td>
                      <td className="td text-right tabular-nums">
                        {formatMoney(product.preco, product.pais)}
                      </td>
                      <td className="td text-right font-bold text-brand-cyan tabular-nums">
                        {formatMoney(product.gvm_max, 'US')}
                      </td>
                      <td className="td text-right tabular-nums">
                        {product.videos_criadores}
                      </td>
                      <td className="td text-right tabular-nums">
                        {product.quantidade_criadores}
                      </td>
                      <td className="td text-center">
                        <ScorePill score={product.max_score} />
                      </td>
                      <td className="td">
                        <StatusBadge status={product.status} />
                      </td>
                      <td className="td whitespace-nowrap text-slate-400">
                        {formatDate(product.created_at)}
                      </td>
                      <td className="td">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/admin/produtos/${product.id}/editar`}
                            aria-label={`Editar ${product.nome}`}
                            className="btn-secondary size-9 p-0"
                          >
                            <Pencil className="size-4" />
                          </Link>
                          <DeleteProductButton
                            productId={product.id}
                            productName={product.nome}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6">
        <Pagination
          page={result.page}
          totalPages={result.totalPages}
          total={result.total}
          buildHref={(page) => buildProductHref(filters, { page }, '/admin')}
        />
      </div>
    </>
  );
}

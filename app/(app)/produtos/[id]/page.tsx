import {
  ArrowLeft,
  CalendarDays,
  Coins,
  ExternalLink,
  Globe2,
  Lightbulb,
  Pencil,
  Tag,
  Users,
  Video,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { FavoriteButton } from '@/components/favorite-button';
import { ProductImage } from '@/components/product-image';
import { ScoreBadge } from '@/components/score-badge';
import { StatusBadge } from '@/components/status-badge';
import { findPais } from '@/lib/constants';
import {
  formatCompact,
  formatDateTime,
  formatMoney,
  formatNumber,
  formatPercent,
  truncate,
} from '@/lib/format';
import { fetchFavoriteIds, fetchProductById } from '@/lib/products';
import { scoreBand } from '@/lib/score';
import { requireProfile } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const product = await fetchProductById(supabase, id);
  return { title: product ? truncate(product.nome, 60) : 'Produto não encontrado' };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireProfile();
  const { id } = await params;

  const supabase = await createClient();
  const product = await fetchProductById(supabase, id);

  if (!product) notFound();

  const favoriteIds = await fetchFavoriteIds(supabase, profile.id);
  const favorited = favoriteIds.includes(product.id);
  const pais = findPais(product.pais);
  const band = scoreBand(product.max_score);

  const { data: relacionados } = await supabase
    .from('products')
    .select('*')
    .eq('categoria', product.categoria ?? '')
    .neq('id', product.id)
    .order('max_score', { ascending: false, nullsFirst: false })
    .limit(3);

  return (
    <>
      <Link
        href="/produtos"
        className="btn-ghost mb-4 -ml-2 px-2 text-sm"
      >
        <ArrowLeft className="size-4" />
        Voltar para produtos
      </Link>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <div className="panel overflow-hidden">
            <div className="grid gap-6 p-5 sm:grid-cols-[240px_minmax(0,1fr)] sm:p-6">
              <ProductImage
                src={product.imagem}
                alt={product.nome}
                className="aspect-square w-full sm:w-60"
              />

              <div className="min-w-0 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={product.status} />
                  {product.categoria ? (
                    <span className="chip border-white/10 bg-white/5 text-slate-300">
                      <Tag className="size-3" />
                      {product.categoria}
                    </span>
                  ) : null}
                  {pais ? (
                    <span className="chip border-white/10 bg-white/5 text-slate-300">
                      <Globe2 className="size-3" />
                      {pais.label}
                    </span>
                  ) : null}
                </div>

                <h1 className="text-2xl leading-tight font-black text-balance text-white sm:text-3xl">
                  {product.nome}
                </h1>

                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <ScoreBadge score={product.max_score} size="lg" />
                  <p className="text-xs text-slate-400">
                    <span className="font-bold text-white">{band.label}</span>
                    <br />
                    Classificação MAX SCORE
                  </p>
                </div>

                <p className="flex items-center gap-2 text-xs text-slate-500">
                  <CalendarDays className="size-3.5" />
                  Cadastrado em {formatDateTime(product.created_at)}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard
              label="GVM Max"
              value={`$ ${formatCompact(product.gvm_max)}`}
              hint={`US$ ${formatNumber(product.gvm_max, 2)}`}
              icon={Coins}
              accent
            />
            <MetricCard
              label="Vídeos de criadores"
              value={formatNumber(product.videos_criadores)}
              hint="publicações no TikTok"
              icon={Video}
            />
            <MetricCard
              label="Criadores ativos"
              value={formatNumber(product.quantidade_criadores)}
              hint="promovendo o produto"
              icon={Users}
            />
          </div>

          {product.descricao ? (
            <section className="panel p-5 sm:p-6">
              <h2 className="mb-3 text-sm font-bold tracking-wider text-slate-400 uppercase">
                Descrição
              </h2>
              <p className="text-sm leading-relaxed whitespace-pre-line text-slate-300">
                {product.descricao}
              </p>
            </section>
          ) : null}

          {product.estrategia ? (
            <section className="panel border-brand-lime/20 bg-brand-lime/3 p-5 sm:p-6">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold tracking-wider text-brand-lime uppercase">
                <Lightbulb className="size-4" />
                Estratégia sugerida
              </h2>
              <p className="text-sm leading-relaxed whitespace-pre-line text-slate-300">
                {product.estrategia}
              </p>
            </section>
          ) : null}

          {relacionados && relacionados.length > 0 ? (
            <section>
              <h2 className="mb-3 text-sm font-bold tracking-wider text-slate-400 uppercase">
                Outros produtos em {product.categoria}
              </h2>
              <div className="panel divide-y divide-white/5 overflow-hidden">
                {relacionados.map((item) => (
                  <Link
                    key={String(item.id)}
                    href={`/produtos/${String(item.id)}`}
                    className="flex items-center gap-3 p-3 transition hover:bg-white/3"
                  >
                    <ProductImage
                      src={(item.imagem as string | null) ?? null}
                      alt={String(item.nome)}
                      className="size-10 shrink-0"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
                      {String(item.nome)}
                    </span>
                    <span className="text-xs text-slate-500 tabular-nums">
                      $ {formatCompact(Number(item.gvm_max ?? 0))}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <div className="panel space-y-4 p-5">
            <h2 className="text-sm font-bold tracking-wider text-slate-400 uppercase">
              Comercial
            </h2>

            <dl className="space-y-3 text-sm">
              <Row label="Preço" value={formatMoney(product.preco, product.pais)} strong />
              <Row label="Comissão" value={formatPercent(product.comissao)} strong />
              <Row
                label="Ganho por venda"
                value={formatMoney(
                  (product.preco * product.comissao) / 100,
                  product.pais,
                )}
              />
              <Row label="GVM Max" value={`$ ${formatNumber(product.gvm_max, 2)}`} />
              <Row label="Vídeos de criadores" value={formatNumber(product.videos_criadores)} />
              <Row label="Criadores ativos" value={formatNumber(product.quantidade_criadores)} />
            </dl>

            {product.link_tiktok ? (
              <a
                href={product.link_tiktok}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="btn-primary w-full"
              >
                <ExternalLink className="size-4" />
                Abrir produto TikTok Shop
              </a>
            ) : (
              <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-xs text-slate-400">
                Link TikTok Shop não informado pela administração.
              </p>
            )}

            <FavoriteButton
              productId={product.id}
              favorited={favorited}
              variant="full"
            />
          </div>

          {profile.role === 'admin' ? (
            <div className="panel space-y-3 p-5">
              <h2 className="text-sm font-bold tracking-wider text-slate-400 uppercase">
                Administração
              </h2>
              <Link
                href={`/admin/produtos/${product.id}/editar`}
                className="btn-secondary w-full"
              >
                <Pencil className="size-4" />
                Editar produto
              </Link>
              <p className="text-xs text-slate-500">
                Atualizado em {formatDateTime(product.updated_at)}
              </p>
            </div>
          ) : null}
        </aside>
      </div>
    </>
  );
}

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: boolean;
}) {
  return (
    <div className="panel p-4">
      <p className="flex items-center gap-2 text-xs font-bold tracking-wider text-slate-400 uppercase">
        <Icon className={`size-4 ${accent ? 'text-brand-cyan' : 'text-slate-500'}`} />
        {label}
      </p>
      <p
        className={`mt-2 text-2xl font-black tabular-nums ${accent ? 'text-brand-cyan' : 'text-white'}`}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-2 last:border-0 last:pb-0">
      <dt className="text-slate-400">{label}</dt>
      <dd
        className={`tabular-nums ${strong ? 'text-base font-bold text-white' : 'text-slate-200'}`}
      >
        {value}
      </dd>
    </div>
  );
}

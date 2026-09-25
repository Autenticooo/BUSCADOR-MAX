import {
  CalendarPlus,
  Flame,
  Package,
  Search,
  Star,
  TrendingUp,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { ProductCard } from '@/components/product-card';
import { ProductImage } from '@/components/product-image';
import { ScorePill } from '@/components/score-badge';
import { StatusBadge } from '@/components/status-badge';
import { StatCard } from '@/components/stat-card';
import { formatCompact, formatMoney, timeAgo } from '@/lib/format';
import { fetchDashboardStats, fetchFavoriteIds } from '@/lib/products';
import { requireProfile } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [stats, favoriteIds] = await Promise.all([
    fetchDashboardStats(supabase, profile.id),
    fetchFavoriteIds(supabase, profile.id),
  ]);

  const favorites = new Set(favoriteIds);
  const firstName = (profile.nome || profile.email).split(' ')[0];

  return (
    <>
      <PageHeader
        title={`Olá, ${firstName}`}
        description="Visão geral da base de produtos TikTok Shop cadastrada pela administração."
        actions={
          <>
            <Link href="/produtos" className="btn-primary">
              <Search className="size-4" />
              Buscar produtos
            </Link>
            <Link href="/favoritos" className="btn-secondary">
              <Star className="size-4" />
              Meus favoritos
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Produtos disponíveis"
          value={stats.total}
          hint="Total na base"
          icon={Package}
          tone="cyan"
        />
        <StatCard
          label="Adicionados hoje"
          value={stats.hoje}
          hint="Novidades do dia"
          icon={CalendarPlus}
          tone="violet"
        />
        <StatCard
          label="Produtos em alta"
          value={stats.emAlta}
          hint="Marcados pela administração"
          icon={Flame}
          tone="pink"
        />
        <StatCard
          label="Meus favoritos"
          value={stats.favoritos}
          hint="Salvos por você"
          icon={Star}
          tone="lime"
        />
      </div>

      <section className="mt-8">
        <SectionHeader
          icon={Flame}
          title="Produtos em alta"
          description="Melhor MAX SCORE entre os produtos marcados como em alta"
          href="/produtos?status=em_alta&sort=score_desc"
          linkLabel="Ver todos"
        />

        {stats.emAltaList.length === 0 ? (
          <EmptyState
            icon={Flame}
            title="Nenhum produto em alta"
            description="Assim que a administração marcar produtos como “Em alta”, eles aparecem aqui em destaque."
            action={
              <Link href="/produtos" className="btn-secondary">
                Explorar a base
              </Link>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.emAltaList.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                favorited={favorites.has(product.id)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <SectionHeader
          icon={CalendarPlus}
          title="Últimos produtos adicionados"
          description="Os cadastros mais recentes da base"
          href="/produtos?sort=recentes"
          linkLabel="Ver todos"
        />

        {stats.recentes.length === 0 ? (
          <EmptyState
            icon={Package}
            title="A base ainda está vazia"
            description="Nenhum produto foi cadastrado até agora. A administração alimenta a base pelo painel /admin."
            action={
              profile.role === 'admin' ? (
                <Link href="/admin/produtos/novo" className="btn-primary">
                  Cadastrar o primeiro produto
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="panel overflow-hidden">
            <ul className="divide-y divide-white/5">
              {stats.recentes.map((product) => (
                <li key={product.id}>
                  <Link
                    href={`/produtos/${product.id}`}
                    className="flex items-center gap-4 p-3 transition hover:bg-white/3"
                  >
                    <ProductImage
                      src={product.imagem}
                      alt={product.nome}
                      className="size-12 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-white">{product.nome}</p>
                      <p className="truncate text-xs text-slate-500">
                        {product.categoria ?? 'Sem categoria'} ·{' '}
                        {formatMoney(product.preco, product.pais)} · GVM $
                        {formatCompact(product.gvm_max)}
                      </p>
                    </div>
                    <div className="hidden items-center gap-3 sm:flex">
                      <StatusBadge status={product.status} />
                      <ScorePill score={product.max_score} />
                      <span className="w-24 text-right text-xs text-slate-500">
                        {timeAgo(product.created_at)}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  description,
  href,
  linkLabel,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-black text-white">
          <Icon className="size-5 text-brand-cyan" />
          {title}
        </h2>
        <p className="text-sm text-slate-400">{description}</p>
      </div>
      <Link href={href} className="btn-ghost text-sm">
        {linkLabel}
        <TrendingUp className="size-4" />
      </Link>
    </div>
  );
}

export const dynamic = 'force-dynamic';

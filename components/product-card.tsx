import { CalendarDays, Globe2, Users, Video } from 'lucide-react';
import Link from 'next/link';

import { findPais } from '@/lib/constants';
import { formatCompact, formatDate, formatMoney } from '@/lib/format';
import type { Product } from '@/lib/types';

import { FavoriteButton } from './favorite-button';
import { ProductImage } from './product-image';
import { ScoreBadge } from './score-badge';
import { StatusBadge } from './status-badge';

export function ProductCard({
  product,
  favorited,
}: {
  product: Product;
  favorited: boolean;
}) {
  const pais = findPais(product.pais);

  return (
    <article className="panel group flex flex-col overflow-hidden transition hover:border-brand-cyan/30 hover:shadow-[0_20px_60px_-30px_rgb(37_244_238_/_0.5)]">
      <div className="relative">
        <Link href={`/produtos/${product.id}`} className="block">
          <ProductImage
            src={product.imagem}
            alt={product.nome}
            rounded="rounded-none"
            className="aspect-4/3 w-full"
          />
        </Link>
        <div className="absolute top-3 left-3">
          <StatusBadge status={product.status} />
        </div>
        <div className="absolute top-3 right-3">
          <FavoriteButton productId={product.id} favorited={favorited} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
            {product.categoria ? (
              <span className="rounded-md bg-white/5 px-2 py-0.5">{product.categoria}</span>
            ) : null}
            {pais ? (
              <span className="inline-flex items-center gap-1">
                <Globe2 className="size-3" />
                {pais.label}
              </span>
            ) : null}
          </div>

          <h3 className="line-clamp-2 text-[15px] leading-snug font-bold text-white">
            <Link href={`/produtos/${product.id}`} className="hover:text-brand-cyan">
              {product.nome}
            </Link>
          </h3>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <Metric label="GVM Max" value={`$${formatCompact(product.gvm_max)}`} accent />
          <Metric
            label="Vídeos"
            value={formatCompact(product.videos_criadores)}
            icon={<Video className="size-3" />}
          />
          <Metric
            label="Criadores"
            value={formatCompact(product.quantidade_criadores)}
            icon={<Users className="size-3" />}
          />
        </div>

        <div className="flex items-end justify-between gap-3 border-t border-white/8 pt-3">
          <ScoreBadge score={product.max_score} />
          <div className="text-right">
            <p className="text-[11px] tracking-wide text-slate-500 uppercase">Preço</p>
            <p className="text-sm font-bold text-white tabular-nums">
              {formatMoney(product.preco, product.pais)}
            </p>
            <p className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-slate-500">
              <CalendarDays className="size-3" />
              {formatDate(product.created_at)}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

function Metric({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-white/8 bg-ink-900/60 px-1 py-2">
      <p
        className={`text-sm font-bold tabular-nums ${accent ? 'text-brand-cyan' : 'text-white'}`}
      >
        {value}
      </p>
      <p className="mt-0.5 flex items-center justify-center gap-1 text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
        {icon}
        {label}
      </p>
    </div>
  );
}

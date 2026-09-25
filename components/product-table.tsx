import {
  CalendarDays,
  ExternalLink,
  Globe2,
  Users,
  Video,
} from 'lucide-react';
import Link from 'next/link';

import { findPais } from '@/lib/constants';
import { formatCompact, formatDate, formatMoney, formatPercent } from '@/lib/format';
import type { Product } from '@/lib/types';

import { FavoriteButton } from './favorite-button';
import { ProductImage } from './product-image';
import { ScorePill } from './score-badge';
import { StatusBadge } from './status-badge';

/** Tabela densa — visão padrão da listagem */
export function ProductTable({
  products,
  favoriteIds,
}: {
  products: Product[];
  favoriteIds: Set<string>;
}) {
  return (
    <div className="panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] border-collapse">
          <thead className="border-b border-white/8 bg-ink-900/60">
            <tr>
              <th className="th w-10"></th>
              <th className="th">Produto</th>
              <th className="th">Categoria</th>
              <th className="th">País</th>
              <th className="th text-right">GVM Max</th>
              <th className="th text-right">Vídeos</th>
              <th className="th text-right">Criadores</th>
              <th className="th text-center">MAX SCORE</th>
              <th className="th">Status</th>
              <th className="th">Cadastro</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {products.map((product) => {
              const pais = findPais(product.pais);
              return (
                <tr key={product.id} className="group transition hover:bg-white/3">
                  <td className="td">
                    <FavoriteButton
                      productId={product.id}
                      favorited={favoriteIds.has(product.id)}
                    />
                  </td>
                  <td className="td">
                    <Link
                      href={`/produtos/${product.id}`}
                      className="flex min-w-56 items-center gap-3"
                    >
                      <ProductImage
                        src={product.imagem}
                        alt={product.nome}
                        className="size-11 shrink-0"
                      />
                      <span className="min-w-0">
                        <span className="line-clamp-1 font-semibold text-white group-hover:text-brand-cyan">
                          {product.nome}
                        </span>
                        <span className="line-clamp-1 text-xs text-slate-500">
                          {formatMoney(product.preco, product.pais)} · comissão{' '}
                          {formatPercent(product.comissao, 0)}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="td whitespace-nowrap text-slate-400">
                    {product.categoria ?? '—'}
                  </td>
                  <td className="td whitespace-nowrap">
                    {pais ? (
                      <span className="inline-flex items-center gap-1.5 text-slate-400">
                        <Globe2 className="size-3.5 text-slate-600" />
                        {pais.label}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="td text-right font-bold text-brand-cyan tabular-nums">
                    ${formatCompact(product.gvm_max)}
                  </td>
                  <td className="td text-right tabular-nums">
                    <span className="inline-flex items-center gap-1.5">
                      <Video className="size-3.5 text-slate-600" />
                      {formatCompact(product.videos_criadores)}
                    </span>
                  </td>
                  <td className="td text-right tabular-nums">
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="size-3.5 text-slate-600" />
                      {formatCompact(product.quantidade_criadores)}
                    </span>
                  </td>
                  <td className="td text-center">
                    <ScorePill score={product.max_score} />
                  </td>
                  <td className="td">
                    <StatusBadge status={product.status} />
                  </td>
                  <td className="td whitespace-nowrap text-slate-400">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="size-3.5 text-slate-600" />
                      {formatDate(product.created_at)}
                    </span>
                  </td>
                  <td className="td text-right">
                    <Link
                      href={`/produtos/${product.id}`}
                      aria-label={`Abrir ${product.nome}`}
                      className="btn-ghost size-8 p-0"
                    >
                      <ExternalLink className="size-4" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

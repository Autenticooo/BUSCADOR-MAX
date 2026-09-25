'use client';

import { Star } from 'lucide-react';
import { useOptimistic, useState, useTransition } from 'react';

import { toggleFavoriteAction } from '@/app/actions/favorites';

export function FavoriteButton({
  productId,
  favorited,
  variant = 'icon',
}: {
  productId: string;
  favorited: boolean;
  variant?: 'icon' | 'full';
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useOptimistic(favorited);

  function toggle() {
    setError(null);
    startTransition(async () => {
      setOptimistic(!optimistic);
      const result = await toggleFavoriteAction(productId);
      if (!result.ok) setError(result.error);
    });
  }

  if (variant === 'full') {
    return (
      <div className="space-y-1">
        <button
          type="button"
          onClick={toggle}
          disabled={isPending}
          aria-pressed={optimistic}
          className={`btn w-full ${
            optimistic
              ? 'border border-brand-pink/40 bg-brand-pink/15 text-brand-pink hover:bg-brand-pink/25'
              : 'btn-secondary'
          }`}
        >
          <Star className="size-4" fill={optimistic ? 'currentColor' : 'none'} />
          {optimistic ? 'Salvo nos favoritos' : 'Salvar nos favoritos'}
        </button>
        {error ? <p className="text-xs text-brand-pink">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        disabled={isPending}
        aria-pressed={optimistic}
        aria-label={optimistic ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
        title={optimistic ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
        className={`grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg border transition ${
          optimistic
            ? 'border-brand-pink/50 bg-brand-pink/15 text-brand-pink'
            : 'border-white/10 bg-ink-900/60 text-slate-400 hover:border-white/20 hover:text-slate-100'
        } ${isPending ? 'opacity-60' : ''}`}
      >
        <Star className="size-4" fill={optimistic ? 'currentColor' : 'none'} />
      </button>
      {error ? (
        <span className="absolute top-full right-0 z-10 mt-1 w-48 rounded-lg border border-brand-pink/40 bg-ink-900 p-2 text-xs text-brand-pink">
          {error}
        </span>
      ) : null}
    </div>
  );
}

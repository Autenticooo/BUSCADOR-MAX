'use client';

import { ImageIcon } from 'lucide-react';
import { useState } from 'react';

/**
 * Imagem do produto com fallback.
 * Usa <img> (não next/image) porque as URLs vêm de CDNs variados do TikTok Shop
 * e o otimizador pode ser bloqueado por hotlink protection.
 */
export function ProductImage({
  src,
  alt,
  className = '',
  rounded = 'rounded-xl',
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  rounded?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`grid place-items-center border border-white/8 bg-gradient-to-br from-ink-800 to-ink-900 text-slate-600 ${rounded} ${className}`}
      >
        <ImageIcon className="size-1/3" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`border border-white/8 bg-ink-800 object-cover ${rounded} ${className}`}
    />
  );
}

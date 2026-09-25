import { Zap } from 'lucide-react';

import { APP_NAME } from '@/lib/constants';

export function Logo({
  size = 'md',
  showText = true,
}: {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}) {
  const box =
    size === 'lg' ? 'size-11' : size === 'sm' ? 'size-8' : 'size-9';
  const text =
    size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-sm' : 'text-base';

  const [first, ...rest] = APP_NAME.split(' ');

  return (
    <span className="flex items-center gap-2.5">
      <span
        className={`${box} grid shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-cyan via-brand-cyan to-brand-lime text-ink-950 shadow-[0_10px_30px_-10px_rgb(37_244_238_/_0.9)]`}
      >
        <Zap className="size-1/2" strokeWidth={2.6} fill="currentColor" />
      </span>
      {showText ? (
        <span className={`font-black tracking-tight ${text}`}>
          <span className="text-white">{first}</span>{' '}
          <span className="bg-gradient-to-r from-brand-cyan to-brand-lime bg-clip-text text-transparent">
            {rest.join(' ')}
          </span>
        </span>
      ) : null}
    </span>
  );
}

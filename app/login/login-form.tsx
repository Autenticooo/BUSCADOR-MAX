'use client';

import { ArrowRight, Loader2, Lock, Mail } from 'lucide-react';
import { useActionState } from 'react';

import { signInAction, type LoginResult } from '@/app/actions/auth';

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, isPending] = useActionState<LoginResult | null, FormData>(
    signInAction,
    null,
  );

  return (
    <form action={formAction} className="mt-6 space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />

      <label className="block">
        <span className="field-label">E-mail</span>
        <div className="relative">
          <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" />
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="voce@empresa.com"
            className="field pl-9"
          />
        </div>
        {state?.ok === false && state.fieldErrors?.email ? (
          <span className="mt-1 block text-xs text-brand-pink">
            {state.fieldErrors.email}
          </span>
        ) : null}
      </label>

      <label className="block">
        <span className="field-label">Senha</span>
        <div className="relative">
          <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" />
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            className="field pl-9"
          />
        </div>
        {state?.ok === false && state.fieldErrors?.password ? (
          <span className="mt-1 block text-xs text-brand-pink">
            {state.fieldErrors.password}
          </span>
        ) : null}
      </label>

      {state?.ok === false ? (
        <p className="rounded-xl border border-brand-pink/40 bg-brand-pink/10 px-4 py-3 text-sm text-brand-pink">
          {state.error}
        </p>
      ) : null}

      <button type="submit" disabled={isPending} className="btn-primary w-full">
        {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
        Entrar
        {isPending ? null : <ArrowRight className="size-4" />}
      </button>
    </form>
  );
}

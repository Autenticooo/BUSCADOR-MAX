'use client';

import { KeyRound, Loader2, Save } from 'lucide-react';
import { useActionState } from 'react';

import { changePasswordAction, updateProfileAction } from '@/app/actions/profile';
import type { ActionResult } from '@/lib/types';

export function ProfileForm({ nome, email }: { nome: string; email: string }) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    updateProfileAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-4">
      <label className="block">
        <span className="field-label">Nome de exibição</span>
        <input name="nome" defaultValue={nome} required className="field" />
        {state?.ok === false && state.fieldErrors?.nome ? (
          <span className="mt-1 block text-xs text-brand-pink">
            {state.fieldErrors.nome}
          </span>
        ) : null}
      </label>

      <label className="block">
        <span className="field-label">E-mail (não editável)</span>
        <input value={email} disabled className="field" />
      </label>

      <Feedback state={state} />

      <button type="submit" disabled={isPending} className="btn-primary">
        {isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        Salvar perfil
      </button>
    </form>
  );
}

export function PasswordForm() {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    changePasswordAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-4">
      <label className="block">
        <span className="field-label">Nova senha</span>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          className="field"
        />
        {state?.ok === false && state.fieldErrors?.password ? (
          <span className="mt-1 block text-xs text-brand-pink">
            {state.fieldErrors.password}
          </span>
        ) : null}
      </label>

      <label className="block">
        <span className="field-label">Confirmar nova senha</span>
        <input
          name="confirmation"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          className="field"
        />
        {state?.ok === false && state.fieldErrors?.confirmation ? (
          <span className="mt-1 block text-xs text-brand-pink">
            {state.fieldErrors.confirmation}
          </span>
        ) : null}
      </label>

      <Feedback state={state} />

      <button type="submit" disabled={isPending} className="btn-secondary">
        {isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <KeyRound className="size-4" />
        )}
        Alterar senha
      </button>
    </form>
  );
}

function Feedback({ state }: { state: ActionResult | null }) {
  if (!state) return null;
  return (
    <p
      className={`rounded-xl border px-4 py-3 text-sm ${
        state.ok
          ? 'border-brand-lime/40 bg-brand-lime/10 text-brand-lime'
          : 'border-brand-pink/40 bg-brand-pink/10 text-brand-pink'
      }`}
    >
      {state.ok ? (state.message ?? 'Salvo.') : state.error}
    </p>
  );
}

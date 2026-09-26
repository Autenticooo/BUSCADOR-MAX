'use client';

import { ArrowRight, CircleCheck, Loader2, Lock, Mail, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useActionState } from 'react';

import { signUpAction, type SignUpResult } from '@/app/actions/auth';
import { ACCOUNT_CREATED_MESSAGE } from '@/lib/constants';

export function SignupForm() {
  const [state, formAction, isPending] = useActionState<SignUpResult | null, FormData>(
    signUpAction,
    null,
  );

  // Conta criada: o acesso continua bloqueado (ativo = false) até a
  // confirmação da assinatura — mostramos o aviso em vez de logar.
  if (state?.ok === true) {
    return (
      <div className="mt-6 space-y-4">
        <p className="rounded-xl border border-brand-lime/40 bg-brand-lime/10 px-4 py-3 text-sm text-brand-lime">
          <CircleCheck className="mr-2 inline size-4 align-[-2px]" />
          {ACCOUNT_CREATED_MESSAGE}
        </p>
        {state.emailConfirmationRequired ? (
          <p className="text-xs text-slate-500">
            Enviamos um e-mail de confirmação para você. Confirme o endereço antes
            de entrar — o acesso à área de membros continua dependendo da
            assinatura ativa.
          </p>
        ) : null}
        <Link href="/login" className="btn-primary w-full">
          Ir para o login
          <ArrowRight className="size-4" />
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-6 space-y-4" noValidate>
      <label className="block">
        <span className="field-label">Nome</span>
        <div className="relative">
          <UserRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" />
          <input
            name="nome"
            type="text"
            autoComplete="name"
            required
            placeholder="Seu nome completo"
            className="field pl-9"
          />
        </div>
        {state?.ok === false && state.fieldErrors?.nome ? (
          <span className="mt-1 block text-xs text-brand-pink">
            {state.fieldErrors.nome}
          </span>
        ) : null}
      </label>

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
            autoComplete="new-password"
            required
            placeholder="Mínimo de 6 caracteres"
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
        Criar conta
        {isPending ? null : <ArrowRight className="size-4" />}
      </button>

      <p className="text-xs text-slate-500">
        O cadastro é gratuito, mas o acesso à área de membros é liberado somente
        após a confirmação da assinatura.
      </p>
    </form>
  );
}

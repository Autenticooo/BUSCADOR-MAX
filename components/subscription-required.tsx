import { CreditCard, LogOut, RefreshCw } from 'lucide-react';
import Link from 'next/link';

import { signOutAction } from '@/app/actions/auth';

import { Logo } from './logo';

/** Wrapper com assinatura de form action (signOutAction sempre redireciona). */
async function signOut() {
  'use server';
  await signOutAction();
}

/**
 * Paywall mostrado quando a conta está logada mas sem assinatura ativa
 * (users.ativo = false). Substitui toda a área de membros: sem sidebar,
 * sem dados — apenas o aviso, a forma de sair e o botão para conferir de
 * novo depois que a administração liberar o acesso.
 *
 * Segue o mesmo padrão visual de <SetupRequired /> e <AdminAccessDenied />.
 */
export function SubscriptionRequired({ email }: { email?: string }) {
  return (
    <div className="grid min-h-screen place-items-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo size="lg" />
        </div>

        <div className="panel p-6 text-center sm:p-8">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl border border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan">
            <CreditCard className="size-7" />
          </span>

          <span className="chip mt-4 border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan">
            Assinatura necessária
          </span>

          <h1 className="mt-4 text-2xl font-black tracking-tight text-white">
            Assinatura ativa necessária
          </h1>

          <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
            {email ? (
              <>
                A conta <span className="font-semibold text-slate-200">{email}</span> está
                logada, mas ainda não tem uma assinatura ativa.
              </>
            ) : (
              <>Sua conta está logada, mas ainda não tem uma assinatura ativa.</>
            )}{' '}
            O acesso ao BUSCADOR MAX é exclusivo para assinantes: dashboard, base de
            produtos, favoritos e demais áreas ficam bloqueados até a confirmação do
            pagamento.
          </p>

          <div className="mx-auto mt-6 max-w-md rounded-xl border border-white/8 bg-ink-900/60 px-4 py-3 text-left text-xs text-slate-500">
            <p className="font-semibold text-slate-400">Já realizou o pagamento?</p>
            <p className="mt-1">
              Assim que a administração confirmar, o acesso é liberado. Clique em
              “Verificar novamente” para conferir se a sua assinatura já está ativa.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/dashboard" className="btn-primary">
              <RefreshCw className="size-4" />
              Verificar novamente
            </Link>
            <form action={signOut}>
              <button type="submit" className="btn-secondary">
                <LogOut className="size-4" />
                Sair
              </button>
            </form>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-600">
          Área restrita a assinantes ativos. Em caso de dúvida sobre o pagamento,
          fale com o suporte.
        </p>
      </div>
    </div>
  );
}

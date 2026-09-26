'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';

type AppError = Error & { digest?: string };

/**
 * Limite de erro da área autenticada.
 *
 * Uma mutation pode terminar no servidor e ainda assim falhar quando o Next
 * tenta atualizar a árvore RSC. Sem este boundary o usuário vê uma tela
 * genérica e pode enviar o cadastro novamente, criando duplicidades.
 */
export default function AppError({
  error,
  reset,
}: {
  error: AppError;
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app error]', error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center px-4 py-12">
      <div
        role="alert"
        className="panel w-full max-w-lg p-8 text-center"
      >
        <span className="mx-auto grid size-14 place-items-center rounded-2xl border border-brand-pink/30 bg-brand-pink/10 text-brand-pink">
          <AlertTriangle className="size-7" />
        </span>

        <h1 className="mt-5 text-2xl font-black text-white">
          Não foi possível atualizar esta página
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          A operação pode ter sido concluída no servidor. Tente carregar a página
          novamente antes de enviar o formulário outra vez.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => reset()} className="btn-primary">
            <RefreshCw className="size-4" />
            Tentar novamente
          </button>
          <Link href="/dashboard" className="btn-secondary">
            Ir para o dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}

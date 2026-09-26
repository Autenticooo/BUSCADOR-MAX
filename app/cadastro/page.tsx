import type { Metadata } from 'next';
import Link from 'next/link';

import { SignupForm } from '@/app/cadastro/signup-form';
import { Logo } from '@/components/logo';
import { SetupRequired } from '@/components/setup-required';
import { supabaseEnv } from '@/lib/supabase/env';

export const metadata: Metadata = { title: 'Criar conta' };

export default function CadastroPage() {
  if (!supabaseEnv().configured) return <SetupRequired />;

  return (
    <main className="grid min-h-screen place-items-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo size="lg" />
          <p className="max-w-xs text-sm text-slate-400">
            Plataforma interna de busca de produtos TikTok Shop em potencial.
          </p>
        </div>

        <div className="panel p-6 sm:p-8">
          <h1 className="text-xl font-black text-white">Criar conta</h1>
          <p className="mt-1 text-sm text-slate-400">
            Cadastre-se para solicitar acesso à área de membros.
          </p>

          <SignupForm />
        </div>

        <p className="mt-6 text-center text-sm text-slate-400">
          Já tem conta?{' '}
          <Link
            href="/login"
            className="font-semibold text-brand-cyan transition hover:text-brand-cyan/80"
          >
            Entrar
          </Link>
        </p>
        <p className="mt-4 text-center text-xs text-slate-600">
          Área restrita. O acesso é liberado após a confirmação da assinatura.
        </p>
      </div>
    </main>
  );
}

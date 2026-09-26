import type { Metadata } from 'next';
import Link from 'next/link';

import { LoginForm } from '@/app/login/login-form';
import { Logo } from '@/components/logo';
import { SetupRequired } from '@/components/setup-required';
import { SUBSCRIPTION_REQUIRED_MESSAGE } from '@/lib/constants';
import { supabaseEnv } from '@/lib/supabase/env';

export const metadata: Metadata = { title: 'Entrar' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  if (!supabaseEnv().configured) return <SetupRequired />;

  const params = await searchParams;
  const next =
    typeof params.next === 'string' && params.next.startsWith('/') && !params.next.startsWith('//')
      ? params.next
      : '/dashboard';

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
          <h1 className="text-xl font-black text-white">Acesso do assinante</h1>
          <p className="mt-1 text-sm text-slate-400">
            Entre com o e-mail e a senha cadastrados.
          </p>

          {params.error ? (
            <p className="mt-4 rounded-xl border border-brand-pink/40 bg-brand-pink/10 px-4 py-3 text-sm text-brand-pink">
              {params.error === 'assinatura'
                ? SUBSCRIPTION_REQUIRED_MESSAGE
                : 'Não foi possível validar seu acesso. Tente novamente.'}
            </p>
          ) : null}

          <LoginForm next={next} />
        </div>

        <p className="mt-6 text-center text-sm text-slate-400">
          Ainda não possui conta?{' '}
          <Link
            href="/cadastro"
            className="font-semibold text-brand-cyan transition hover:text-brand-cyan/80"
          >
            Criar conta
          </Link>
        </p>
        <p className="mt-4 text-center text-xs text-slate-600">
          Área restrita. O acesso é registrado e destinado apenas a assinantes ativos.
        </p>
      </div>
    </main>
  );
}

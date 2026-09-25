import { ArrowLeft, Package, ShieldAlert } from 'lucide-react';
import Link from 'next/link';

/**
 * Mostrado na área /admin quando a pessoa está logada mas não é administradora.
 *
 * Antes o layout chamava notFound() e o assinante comum caía num 404 genérico
 * ("Página não encontrada") — inclusive em /admin/produtos/novo, o que
 * escondia a causa real do problema. A autorização continua sendo decidida no
 * servidor: aqui só trocamos o 404 por uma explicação clara, e o RLS do
 * Postgres segue bloqueando qualquer escrita de quem não é admin.
 */
export function AdminAccessDenied({ email }: { email?: string }) {
  return (
    <div className="mx-auto w-full max-w-2xl py-4 sm:py-10">
      <div className="panel p-6 text-center sm:p-10">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl border border-brand-pink/30 bg-brand-pink/10 text-brand-pink">
          <ShieldAlert className="size-7" />
        </span>

        <span className="chip mt-4 border-brand-pink/30 bg-brand-pink/10 text-brand-pink">
          Área restrita
        </span>

        <h1 className="mt-4 text-2xl font-black tracking-tight text-white">
          Acesso de administrador necessário
        </h1>

        <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
          {email ? (
            <>
              A conta <span className="font-semibold text-slate-200">{email}</span> está logada,
              mas não tem a permissão exigida por esta área.
            </>
          ) : (
            <>Sua conta está logada, mas não tem a permissão exigida por esta área.</>
          )}{' '}
          O painel administrativo serve apenas para gerenciar a base de produtos TikTok Shop.
        </p>

        <div className="mx-auto mt-6 max-w-md rounded-xl border border-white/8 bg-ink-900/60 px-4 py-3 text-left text-xs text-slate-500">
          <p className="font-semibold text-slate-400">Precisa cadastrar ou editar produtos?</p>
          <p className="mt-1">
            Peça a um administrador para promover o seu perfil no SQL Editor do Supabase:
          </p>
          <code className="mt-2 block overflow-x-auto rounded-lg border border-white/8 bg-ink-950/80 p-2 text-[11px] text-brand-cyan">
            update public.users set role = &apos;admin&apos; where email = &apos;seu@email.com&apos;;
          </code>
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/dashboard" className="btn-primary">
            <ArrowLeft className="size-4" />
            Voltar para o dashboard
          </Link>
          <Link href="/produtos" className="btn-secondary">
            <Package className="size-4" />
            Ver produtos
          </Link>
        </div>
      </div>
    </div>
  );
}

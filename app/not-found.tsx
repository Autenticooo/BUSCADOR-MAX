import { Compass } from 'lucide-react';
import Link from 'next/link';

import { Logo } from '@/components/logo';

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="panel w-full max-w-md p-8 text-center">
        <div className="flex justify-center">
          <Logo />
        </div>
        <span className="mx-auto mt-6 grid size-14 place-items-center rounded-2xl border border-white/10 bg-white/5 text-slate-500">
          <Compass className="size-7" />
        </span>
        <h1 className="mt-4 text-2xl font-black text-white">Página não encontrada</h1>
        <p className="mt-2 text-sm text-slate-400">
          O endereço não existe ou você não tem permissão para acessá-lo.
        </p>
        <Link href="/dashboard" className="btn-primary mt-6 w-full">
          Voltar para o dashboard
        </Link>
      </div>
    </main>
  );
}

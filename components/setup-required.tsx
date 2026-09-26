import { Database, KeyRound, Terminal } from 'lucide-react';

import { Logo } from './logo';

/**
 * Mostrado quando NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
 * ainda não foram definidos. O sistema não sobe "de mentira": ele exige
 * um projeto Supabase real para funcionar.
 */
export function SetupRequired() {
  return (
    <div className="grid min-h-screen place-items-center px-4 py-12">
      <div className="panel w-full max-w-2xl p-8">
        <Logo size="lg" />
        <h1 className="mt-6 text-2xl font-black text-white">
          Conecte seu projeto Supabase
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          O BUSCADOR MAX não usa banco de dados simulado. Configure as variáveis abaixo
          para liberar o login e a base de produtos.
        </p>

        <ol className="mt-6 space-y-4 text-sm text-slate-300">
          <Step
            icon={KeyRound}
            title="1. Crie o arquivo .env.local na raiz do projeto"
            body={
              <Code>{`NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key`}</Code>
            }
          />
          <Step
            icon={Database}
            title="2. Rode o schema no SQL Editor do Supabase"
            body={
              <Code>{`# cole o conteúdo deste arquivo no SQL Editor e execute
supabase/migrations/0001_init.sql

# (opcional) produtos de exemplo
supabase/seed.sql`}</Code>
            }
          />
          <Step
            icon={Terminal}
            title="3. Crie o usuário e promova a admin"
            body={
              <Code>{`# Authentication > Users > Add user (email + senha)
# depois, no SQL Editor (role admin + libera a assinatura):
update public.users set role = 'admin', ativo = true
where email = 'seu@email.com';`}</Code>
            }
          />
        </ol>

        <p className="mt-6 rounded-xl border border-brand-cyan/25 bg-brand-cyan/5 p-3 text-xs text-slate-400">
          Depois de salvar o <code className="text-brand-cyan">.env.local</code>, reinicie
          o servidor (<code className="text-brand-cyan">npm run dev</code>) e recarregue
          esta página.
        </p>
      </div>
    </div>
  );
}

function Step({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-brand-cyan">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-white">{title}</p>
        <div className="mt-2">{body}</div>
      </div>
    </li>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-white/8 bg-ink-950/80 p-3 text-xs leading-relaxed text-slate-300">
      {children}
    </pre>
  );
}

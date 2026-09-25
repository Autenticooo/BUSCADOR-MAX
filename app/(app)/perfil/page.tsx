import { BadgeCheck, KeyRound, ShieldCheck, Star, UserRound } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { PageHeader } from '@/components/page-header';
import { PasswordForm, ProfileForm } from '@/components/profile-forms';
import { formatDateTime } from '@/lib/format';
import { requireProfile } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Perfil' };
export const dynamic = 'force-dynamic';

export default async function PerfilPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { count: totalFavoritos } = await supabase
    .from('favorites')
    .select('product_id', { count: 'exact', head: true })
    .eq('user_id', profile.id);

  const { data: session } = await supabase.auth.getSession();

  return (
    <>
      <PageHeader
        title="Perfil"
        description="Seus dados de acesso e preferências dentro do BUSCADOR MAX."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <section className="panel p-5 sm:p-6">
            <SectionTitle icon={UserRound} title="Dados da conta" />
            <div className="mt-5">
              <ProfileForm nome={profile.nome ?? ''} email={profile.email} />
            </div>
          </section>

          <section className="panel p-5 sm:p-6">
            <SectionTitle
              icon={KeyRound}
              title="Segurança"
              hint="A senha é gerenciada pelo Supabase Auth"
            />
            <div className="mt-5">
              <PasswordForm />
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="panel p-5">
            <h2 className="text-sm font-bold tracking-wider text-slate-400 uppercase">
              Assinatura
            </h2>

            <dl className="mt-4 space-y-3 text-sm">
              <Info
                label="Tipo de acesso"
                value={profile.role === 'admin' ? 'Administrador' : 'Assinante'}
                icon={profile.role === 'admin' ? ShieldCheck : BadgeCheck}
                tone={profile.role === 'admin' ? 'lime' : 'cyan'}
              />
              <Info
                label="Situação"
                value={profile.ativo ? 'Ativo' : 'Suspenso'}
              />
              <Info label="Membro desde" value={formatDateTime(profile.created_at)} />
              <Info
                label="Produtos salvos"
                value={String(totalFavoritos ?? 0)}
                icon={Star}
              />
              <Info
                label="Sessão expira em"
                value={
                  session.session?.expires_at
                    ? formatDateTime(new Date(session.session.expires_at * 1000))
                    : '—'
                }
              />
            </dl>

            <Link href="/favoritos" className="btn-secondary mt-5 w-full">
              <Star className="size-4" />
              Ver meus favoritos
            </Link>
          </div>

          {profile.role === 'admin' ? (
            <div className="panel border-brand-lime/25 bg-brand-lime/3 p-5">
              <h2 className="flex items-center gap-2 text-sm font-bold text-brand-lime">
                <ShieldCheck className="size-4" />
                Acesso administrativo
              </h2>
              <p className="mt-2 text-xs text-slate-400">
                Você pode cadastrar, editar e excluir produtos da base.
              </p>
              <Link href="/admin" className="btn-primary mt-4 w-full">
                Abrir painel admin
              </Link>
            </div>
          ) : null}
        </aside>
      </div>
    </>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-white/8 pb-4">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-brand-cyan">
        <Icon className="size-4" />
      </span>
      <div>
        <h2 className="text-sm font-bold text-white">{title}</h2>
        {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
      </div>
    </div>
  );
}

function Info({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: 'cyan' | 'lime';
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/5 pb-2 last:border-0 last:pb-0">
      <dt className="text-slate-400">{label}</dt>
      <dd className="flex items-center gap-1.5 text-right font-semibold text-slate-100">
        {Icon ? (
          <Icon
            className={`size-3.5 ${tone === 'lime' ? 'text-brand-lime' : 'text-brand-cyan'}`}
          />
        ) : null}
        {value}
      </dd>
    </div>
  );
}

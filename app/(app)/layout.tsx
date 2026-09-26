import { AppShell } from '@/components/app-shell';
import { SetupRequired } from '@/components/setup-required';
import { SubscriptionRequired } from '@/components/subscription-required';
import { hasActiveSubscription, requireProfile } from '@/lib/session';
import { supabaseEnv } from '@/lib/supabase/env';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!supabaseEnv().configured) return <SetupRequired />;

  const profile = await requireProfile();

  // Paywall: conta logada, mas sem assinatura ativa (ativo = false).
  // Admin (role = 'admin') entra independentemente do campo ativo.
  // O bloqueio cobre TODAS as páginas do grupo (dashboard, produtos,
  // favoritos, perfil e páginas internas) — nenhum dado é renderizado.
  if (!hasActiveSubscription(profile)) {
    return <SubscriptionRequired email={profile.email} />;
  }

  return <AppShell profile={profile}>{children}</AppShell>;
}

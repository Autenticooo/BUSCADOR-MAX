import { AppShell } from '@/components/app-shell';
import { SetupRequired } from '@/components/setup-required';
import { requireProfile } from '@/lib/session';
import { supabaseEnv } from '@/lib/supabase/env';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!supabaseEnv().configured) return <SetupRequired />;

  const profile = await requireProfile();

  return <AppShell profile={profile}>{children}</AppShell>;
}

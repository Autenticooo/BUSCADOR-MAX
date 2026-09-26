import { redirect } from 'next/navigation';

import { AdminAccessDenied } from '@/components/admin-access-denied';
import { getCurrentProfile } from '@/lib/session';

/**
 * /admin — exige sessão e role = 'admin'.
 *
 * Sem sessão: redirect('/login').
 * Logado sem ser admin: renderiza <AdminAccessDenied /> em vez de notFound(),
 * para que o assinante entenda o motivo em vez de cair num 404.
 *
 * As páginas filhas repetem a checagem (mesmo que o Next renderize o children
 * antes deste layout) e o RLS do Postgres continua bloqueando qualquer escrita
 * vinda de não-admin.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();

  if (!profile) redirect('/login');
  if (profile.role !== 'admin') return <AdminAccessDenied email={profile.email} />;

  return <>{children}</>;
}

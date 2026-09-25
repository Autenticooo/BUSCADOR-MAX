import { requireAdmin } from '@/lib/session';

/**
 * /admin — exige sessão e role = 'admin'.
 * `requireAdmin()` chama notFound() para quem não é administrador;
 * o RLS do Postgres bloqueia também qualquer escrita vinda de não-admin.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return <>{children}</>;
}

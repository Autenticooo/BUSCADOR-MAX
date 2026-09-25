import { redirect } from 'next/navigation';

/**
 * Não há landing page: a raiz leva direto para a área de membros
 * (o middleware também faz esse desvio).
 */
export default function RootPage() {
  redirect('/dashboard');
}

import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';

/**
 * Callback de OAuth / magic link (Supabase Auth).
 * Troca o código pela sessão, garante o perfil em public.users
 * e devolve o usuário para a área de membros.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get('code');
  const rawNext = searchParams.get('next') ?? '/dashboard';
  const next =
    rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { error: rpcError } = await supabase.rpc('ensure_profile', {
          p_id: user.id,
          p_email: user.email ?? '',
          p_nome: (user.user_metadata?.nome as string | undefined) ?? null,
        });
        if (rpcError) console.error('[auth/callback:ensure_profile]', rpcError.message);

        // paywall (mesma regra do login por senha): sem assinatura ativa,
        // a sessão é encerrada e o usuário volta para o login avisado.
        const { data: profile } = await supabase
          .from('users')
          .select('role, ativo')
          .eq('id', user.id)
          .maybeSingle();

        if (profile && profile.role !== 'admin' && profile.ativo !== true) {
          await supabase.auth.signOut();
          return NextResponse.redirect(`${origin}/login?error=assinatura`);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }

    console.error('[auth/callback]', error.message);
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}

'use server';

import { redirect } from 'next/navigation';

import { SUBSCRIPTION_REQUIRED_MESSAGE } from '@/lib/constants';
import { translateAuthError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import { supabaseEnv } from '@/lib/supabase/env';
import { formDataToObject, loginSchema } from '@/lib/validators';
import type { ActionResult } from '@/lib/types';

export type LoginResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function signInAction(
  _prev: LoginResult | null,
  formData: FormData,
): Promise<LoginResult> {
  const parsed = loginSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? '_form');
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, error: 'Verifique os campos destacados.', fieldErrors };
  }

  if (!supabaseEnv().configured) {
    return {
      ok: false,
      error:
        'Supabase não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY em .env.local.',
    };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { ok: false, error: translateAuthError(error) };
  }

  // garante que a linha em public.users existe (idempotente)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { error: rpcError } = await supabase.rpc('ensure_profile', {
      p_id: user.id,
      p_email: user.email ?? parsed.data.email,
      p_nome: null,
    });
    if (rpcError) console.error('[signInAction:ensure_profile]', rpcError.message);

    // paywall: usuário comum precisa de assinatura ativa (ativo = true).
    // role = 'admin' entra independentemente do campo ativo.
    const { data: profile } = await supabase
      .from('users')
      .select('role, ativo')
      .eq('id', user.id)
      .maybeSingle();

    if (profile && profile.role !== 'admin' && profile.ativo !== true) {
      // derruba a sessão recém-criada: sem assinatura, sem área de membros
      await supabase.auth.signOut();
      return {
        ok: false,
        error: SUBSCRIPTION_REQUIRED_MESSAGE,
      };
    }
  }

  const next = String(formData.get('next') ?? '') || '/dashboard';
  // protege contra open redirect
  const redirectTo = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';

  redirect(redirectTo);
}

export async function signOutAction(): Promise<ActionResult> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

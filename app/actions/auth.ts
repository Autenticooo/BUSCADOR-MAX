'use server';

import { redirect } from 'next/navigation';

import { SUBSCRIPTION_REQUIRED_MESSAGE } from '@/lib/constants';
import { translateAuthError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import { supabaseEnv } from '@/lib/supabase/env';
import { formDataToObject, loginSchema, signupSchema } from '@/lib/validators';
import type { ActionResult } from '@/lib/types';

export type LoginResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export type SignUpResult =
  | { ok: true; emailConfirmationRequired: boolean }
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

/**
 * Cadastro público (/cadastro).
 *
 * Cria o usuário no Supabase Auth; o perfil em public.users nasce com
 * ativo = false e role = 'user' (default da migration 0002 — o cadastro NÃO
 * libera o paywall). Depois mostramos a mensagem de "conta criada": o acesso
 * depende da confirmação da assinatura pela administração.
 */
export async function signUpAction(
  _prev: SignUpResult | null,
  formData: FormData,
): Promise<SignUpResult> {
  const parsed = signupSchema.safeParse(formDataToObject(formData));

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

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { nome: parsed.data.nome } },
  });

  if (error) {
    return { ok: false, error: translateAuthError(error) };
  }

  if (data.session) {
    // Projeto SEM confirmação de e-mail: o signUp já abriu uma sessão.
    // Garante o perfil (mesmo fallback do login) e encerra a sessão — uma
    // conta recém-criada não tem assinatura ativa e não pode navegar logada.
    if (data.user) {
      const { error: rpcError } = await supabase.rpc('ensure_profile', {
        p_id: data.user.id,
        p_email: data.user.email ?? parsed.data.email,
        p_nome: parsed.data.nome,
      });
      if (rpcError) console.error('[signUpAction:ensure_profile]', rpcError.message);
    }
    await supabase.auth.signOut();
  }
  // Com confirmação de e-mail ligada não há sessão: quem cria public.users é
  // o trigger on_auth_user_created (já no INSERT em auth.users).

  return { ok: true, emailConfirmationRequired: !data.session };
}

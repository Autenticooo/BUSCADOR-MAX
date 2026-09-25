import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';

import { mapProfile } from './mappers';
import { createClient } from './supabase/server';
import type { UserProfile } from './types';

/**
 * Perfil do usuário logado (memoizado por request).
 * Se a linha em public.users não existir (ex.: trigger em auth.users não
 * pôde ser criado), cria de forma idempotente via RPC ensure_profile().
 */
export const getCurrentProfile = cache(async (): Promise<UserProfile | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (error) console.error('[getCurrentProfile]', error.message);

  let profile = mapProfile(data);

  if (!profile) {
    const { data: created, error: rpcError } = await supabase.rpc('ensure_profile', {
      p_id: user.id,
      p_email: user.email ?? '',
      p_nome: (user.user_metadata?.nome as string | undefined) ?? null,
    });

    if (rpcError) {
      console.error('[getCurrentProfile:ensure_profile]', rpcError.message);
      return null;
    }
    profile = mapProfile(created as Record<string, unknown> | null);
  }

  return profile;
});

/** Redireciona para /login se não houver sessão. */
export async function requireProfile(): Promise<UserProfile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  return profile;
}

/**
 * Perfil do usuário logado **se** ele for admin; `null` para assinante comum
 * ou visitante. Não lança notFound(): a área /admin usa este helper para
 * renderizar <AdminAccessDenied /> em vez de um 404.
 */
export async function getAdminProfile(): Promise<UserProfile | null> {
  const profile = await getCurrentProfile();
  return profile && profile.role === 'admin' ? profile : null;
}

/**
 * Bloqueia a área administrativa para quem não é admin.
 * Usado pelas Server Actions, onde "negar" é devolver erro em vez de renderizar.
 */
export async function requireAdmin(): Promise<UserProfile> {
  const profile = await requireProfile();
  if (profile.role !== 'admin') notFound();
  return profile;
}

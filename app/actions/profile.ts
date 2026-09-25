'use server';

import { revalidatePath } from 'next/cache';

import { translateDbError } from '@/lib/errors';
import { requireProfile } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from '@/lib/types';
import { fieldErrorsFrom, formDataToObject, profileSchema } from '@/lib/validators';

export async function updateProfileAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  let userId: string;
  try {
    const profile = await requireProfile();
    userId = profile.id;
  } catch {
    return { ok: false, error: 'Você precisa estar logado.' };
  }

  const parsed = profileSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Verifique os campos destacados.',
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = await createClient();

  // RLS (users_update_self) impede alterar o próprio role/ativo
  const { error } = await supabase
    .from('users')
    .update({ nome: parsed.data.nome })
    .eq('id', userId);

  if (error) return { ok: false, error: translateDbError(error) };

  // mantém o nome no auth em sincronia
  await supabase.auth.updateUser({ data: { nome: parsed.data.nome } });

  revalidatePath('/perfil', 'layout');
  return { ok: true, message: 'Perfil atualizado.' };
}

export async function changePasswordAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireProfile();
  } catch {
    return { ok: false, error: 'Você precisa estar logado.' };
  }

  const password = String(formData.get('password') ?? '');
  const confirmation = String(formData.get('confirmation') ?? '');

  if (password.length < 6) {
    return {
      ok: false,
      error: 'A nova senha precisa ter pelo menos 6 caracteres.',
      fieldErrors: { password: 'Mínimo de 6 caracteres' },
    };
  }
  if (password !== confirmation) {
    return {
      ok: false,
      error: 'As senhas não conferem.',
      fieldErrors: { confirmation: 'As senhas não conferem' },
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) return { ok: false, error: error.message };

  return { ok: true, message: 'Senha alterada com sucesso.' };
}

'use server';

import { revalidatePath } from 'next/cache';

import { translateDbError } from '@/lib/errors';
import { requireProfile } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';

export type ToggleFavoriteResult =
  | { ok: true; favorited: boolean }
  | { ok: false; error: string };

/**
 * Liga/desliga o favorito do usuário logado.
 * O RLS garante que ele só mexe nas próprias linhas (user_id = auth.uid()).
 */
export async function toggleFavoriteAction(productId: string): Promise<ToggleFavoriteResult> {
  let userId: string;
  try {
    const profile = await requireProfile();
    userId = profile.id;
  } catch {
    return { ok: false, error: 'Você precisa estar logado para salvar favoritos.' };
  }

  const supabase = await createClient();

  const { count, error: countError } = await supabase
    .from('favorites')
    .select('product_id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('product_id', productId);

  if (countError) return { ok: false, error: translateDbError(countError) };

  const alreadyFavorited = (count ?? 0) > 0;

  if (alreadyFavorited) {
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', userId)
      .eq('product_id', productId);

    if (error) return { ok: false, error: translateDbError(error) };
  } else {
    const { error } = await supabase
      .from('favorites')
      .insert({ user_id: userId, product_id: productId });

    if (error) {
      // corrida: outro clique já inseriu → tratado como favorito
      if (error.code === '23505') return { ok: true, favorited: true };
      return { ok: false, error: translateDbError(error) };
    }
  }

  revalidatePath('/favoritos');
  revalidatePath('/produtos');
  revalidatePath('/dashboard');
  revalidatePath(`/produtos/${productId}`);

  return { ok: true, favorited: !alreadyFavorited };
}

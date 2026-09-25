'use server';

import { revalidatePath } from 'next/cache';

import { translateDbError } from '@/lib/errors';
import { requireAdmin } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from '@/lib/types';
import { fieldErrorsFrom, formDataToObject, productSchema } from '@/lib/validators';

/**
 * Todas as actions abaixo exigem sessão + role = admin no perfil.
 * Além dessa checagem na aplicação, o RLS do Postgres também bloqueia
 * insert/update/delete de quem não é admin (políticas *_admin).
 */

function revalidateProductPaths(id?: string) {
  revalidatePath('/produtos');
  revalidatePath('/dashboard');
  revalidatePath('/favoritos');
  revalidatePath('/admin');
  if (id) revalidatePath(`/produtos/${id}`);
}

export async function createProductAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (error) {
    return { ok: false, error: readRedirectMessage(error) };
  }

  const parsed = productSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Verifique os campos destacados.',
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('products')
    .insert(parsed.data)
    .select('id')
    .single();

  if (error) return { ok: false, error: translateDbError(error) };

  revalidateProductPaths(String(data?.id ?? ''));
  return { ok: true, message: 'Produto cadastrado com sucesso.' };
}

export async function updateProductAction(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (error) {
    return { ok: false, error: readRedirectMessage(error) };
  }

  const parsed = productSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Verifique os campos destacados.',
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('products')
    .update(parsed.data)
    .eq('id', id)
    .select('id');

  if (error) return { ok: false, error: translateDbError(error) };

  // O RLS apenas esconde as linhas: um update sem permissão afeta 0 linhas
  // e volta "sucesso". Aqui isso vira erro explícito.
  if (!data || data.length === 0) {
    return {
      ok: false,
      error: 'Produto não encontrado ou sem permissão para alterar.',
    };
  }

  revalidateProductPaths(id);
  return { ok: true, message: 'Produto atualizado com sucesso.' };
}

export async function deleteProductAction(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (error) {
    return { ok: false, error: readRedirectMessage(error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('products')
    .delete()
    .eq('id', id)
    .select('id');

  if (error) return { ok: false, error: translateDbError(error) };

  if (!data || data.length === 0) {
    return {
      ok: false,
      error: 'Produto não encontrado ou sem permissão para excluir.',
    };
  }

  revalidateProductPaths(id);
  return { ok: true, message: 'Produto excluído.' };
}

/**
 * redirect()/notFound() do Next lançam exceções de controle de fluxo.
 * Aqui elas viram uma mensagem amigável em vez de derrubar a action.
 */
function readRedirectMessage(error: unknown): string {
  const digest = (error as { digest?: string } | null)?.digest ?? '';
  if (digest.startsWith('NEXT_REDIRECT')) return 'Você precisa estar logado para continuar.';
  if (digest === 'NEXT_NOT_FOUND') {
    return 'Acesso negado: esta área é exclusiva para administradores.';
  }
  return error instanceof Error ? error.message : 'Não foi possível validar o acesso.';
}

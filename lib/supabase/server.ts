import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { supabaseEnv } from './env';

/**
 * Client Supabase para Server Components, Server Actions e Route Handlers.
 * Sempre com a anon key + cookies do usuário → o RLS decide o que ele vê.
 */
export async function createClient() {
  const { url, anonKey } = supabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // chamado a partir de um Server Component: pode ser ignorado,
          // o middleware é o responsável por renovar a sessão.
        }
      },
    },
  });
}

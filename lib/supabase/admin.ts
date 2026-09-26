import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

import { supabaseEnv } from './env';

/**
 * Client com a SERVICE ROLE KEY — exclusivo de rotas de servidor SEM sessão
 * de usuário (hoje: o webhook da Kiwify).
 *
 * ⚠️ Esta chave BYPASSA o RLS. Regras:
 *  - nunca importar em páginas, componentes ou Server Actions com sessão;
 *  - o "atores" dessas chamadas é o serviço externo, que já se autenticou
 *    pelo próprio segredo do webhook;
 *  - a chave fica só no process.env do servidor (sem prefixo NEXT_PUBLIC).
 *
 * Devolve null quando a chave não está configurada — a rota decide a resposta.
 */
export function createServiceClient(): SupabaseClient | null {
  const { url, configured } = supabaseEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!configured || !serviceRoleKey) return null;

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

import { createBrowserClient } from '@supabase/ssr';

import { supabaseEnv } from './env';

/**
 * Client Supabase para uso em Client Components ('use client').
 * Usa a anon key: toda a segurança vem do RLS no Postgres.
 */
export function createClient() {
  const { url, anonKey } = supabaseEnv();
  return createBrowserClient(url, anonKey);
}

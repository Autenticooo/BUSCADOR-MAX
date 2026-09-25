/**
 * Leitura centralizada das variáveis de ambiente do Supabase.
 * `configured` é false quando o projeto ainda não foi conectado —
 * nesse caso a aplicação mostra a tela de configuração em vez de quebrar.
 */
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';

  const placeholder =
    !url || !anonKey || url.includes('SEU-PROJETO') || anonKey.includes('eyJhbGciOi...');

  return {
    url: placeholder ? 'https://placeholder.supabase.co' : url,
    anonKey: placeholder ? 'placeholder-anon-key' : anonKey,
    configured: !placeholder,
  };
}

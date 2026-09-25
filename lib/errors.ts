// ============================================================================
// Tradução de erros do Supabase/Auth/Postgres para o usuário final (pt-BR)
// ============================================================================

export interface AuthLikeError {
  message: string;
  /** AuthApiError | AuthRetryableFetchError | AuthInvalidCredentialsError | ... */
  name?: string;
  status?: number;
}

const NETWORK_PATTERN =
  /fetch failed|failed to fetch|networkerror|econnreset|econnrefused|etimedout|enotfound|socket hang up/i;

export function translateAuthError(error: AuthLikeError | string): string {
  const err: AuthLikeError = typeof error === 'string' ? { message: error } : error;
  const message = err.message ?? '';

  // Falha de rede entre o servidor e o Supabase (URL errada, projeto pausado,
  // servidor sem egress). É diferente de credencial errada.
  if (err.name === 'AuthRetryableFetchError' || NETWORK_PATTERN.test(message)) {
    return 'Não foi possível conectar ao Supabase. Verifique NEXT_PUBLIC_SUPABASE_URL, ' +
      'se o projeto está ativo e se o servidor tem acesso à internet.';
  }

  // antes do bloco de credenciais: um 401 por apikey inválida não é senha errada
  if (/invalid api key|invalid x-client-info|apikey/i.test(message)) {
    return 'Chave do Supabase inválida. Confira NEXT_PUBLIC_SUPABASE_ANON_KEY.';
  }

  if (
    err.name === 'AuthInvalidCredentialsError' ||
    err.status === 400 ||
    err.status === 401 ||
    /invalid login credentials|user not found/i.test(message)
  ) {
    return 'E-mail ou senha incorretos.';
  }

  if (err.name === 'AuthSessionMissingError') {
    return 'Sessão expirada. Entre novamente.';
  }

  if (err.name === 'AuthWeakPasswordError' || /password.*too weak|weak password/i.test(message)) {
    return 'A senha é muito fraca para a política do projeto.';
  }

  if (/email not confirmed/i.test(message)) {
    return 'Confirme seu e-mail antes de entrar.';
  }

  if (/rate limit|too many requests/i.test(message)) {
    return 'Muitas tentativas seguidas. Aguarde alguns minutos.';
  }

  if (/relation .* does not exist|schema cache/i.test(message)) {
    return 'Banco sem as tabelas do BUSCADOR MAX. Rode supabase/migrations/0001_init.sql.';
  }

  return message ? `Não foi possível entrar: ${message}` : 'Não foi possível entrar.';
}

export function translateDbError(error: {
  message: string;
  code?: string;
  details?: string | null;
}): string {
  if (error.code === '42501' || /row-level security|permission denied/i.test(error.message)) {
    return 'Permissão negada: apenas administradores podem alterar produtos.';
  }
  if (error.code === '23505') {
    return 'Já existe um registro com esses dados.';
  }
  if (error.code === '23503') {
    return 'Registro relacionado não encontrado (produto ou usuário inexistente).';
  }
  if (error.code === '23514') {
    return `Valor fora do intervalo permitido. ${error.details ?? ''}`.trim();
  }
  if (
    error.code === 'PGRST205' ||
    /relation .* does not exist|could not find the table|schema cache/i.test(error.message)
  ) {
    return 'Tabelas não encontradas. Rode supabase/migrations/0001_init.sql no SQL Editor.';
  }
  if (error.code === 'PGRST116' || /0 rows/i.test(error.message)) {
    return 'Produto não encontrado.';
  }
  if (/fetch failed|failed to fetch|econnreset|econnrefused/i.test(error.message)) {
    return 'Não foi possível conectar ao Supabase a partir do servidor.';
  }
  return error.message || 'Erro inesperado ao salvar.';
}

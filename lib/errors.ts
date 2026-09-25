// ============================================================================
// Tradução de erros do Supabase/Auth/Postgres para o usuário final (pt-BR)
// ============================================================================

export function translateAuthError(message: string): string {
  const map: Record<string, string> = {
    'Invalid login credentials': 'E-mail ou senha incorretos.',
    'Email not confirmed': 'Confirme seu e-mail antes de entrar.',
    'User not found': 'E-mail ou senha incorretos.',
    'Email rate limit exceeded': 'Muitas tentativas. Aguarde alguns minutos.',
    'For security purposes, you can only request this after':
      'Aguarde alguns instantes antes de tentar novamente.',
  };
  return map[message] ?? `Não foi possível entrar: ${message}`;
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
  if (error.code === 'PGRST116' || /0 rows/i.test(error.message)) {
    return 'Produto não encontrado.';
  }
  return error.message || 'Erro inesperado ao salvar.';
}

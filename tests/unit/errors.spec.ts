import { describe, expect, it } from 'vitest';

import { translateAuthError, translateDbError } from '@/lib/errors';

describe('translateAuthError', () => {
  it('distingue falha de rede de credencial errada', () => {
    const rede = translateAuthError({ name: 'AuthRetryableFetchError', message: 'fetch failed' });
    expect(rede).toContain('Não foi possível conectar ao Supabase');

    const credencial = translateAuthError({
      name: 'AuthApiError',
      status: 400,
      message: 'Invalid login credentials',
    });
    expect(credencial).toBe('E-mail ou senha incorretos.');
  });

  it('reconhece ECONNRESET e afins sem depender do nome da classe', () => {
    for (const message of [
      'fetch failed',
      'Failed to fetch',
      'read ECONNRESET',
      'connect ECONNREFUSED 1.2.3.4:443',
      'getaddrinfo ENOTFOUND x.supabase.co',
    ]) {
      expect(translateAuthError({ message })).toContain('Não foi possível conectar');
    }
  });

  it('aponta chave inválida quando a API rejeita o apikey', () => {
    expect(translateAuthError({ message: 'Invalid API key' })).toContain(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    );
  });

  it('aponta migration pendente quando a tabela não existe', () => {
    expect(translateAuthError({ message: 'relation "public.users" does not exist' })).toContain(
      '0001_init.sql',
    );
  });

  it('trata sessão expirada, rate limit e senha fraca', () => {
    expect(translateAuthError({ name: 'AuthSessionMissingError', message: 'x' })).toContain(
      'Sessão expirada',
    );
    expect(translateAuthError({ message: 'For security purposes, rate limit exceeded' })).toContain(
      'Aguarde',
    );
    expect(translateAuthError({ name: 'AuthWeakPasswordError', message: 'x' })).toContain(
      'muito fraca',
    );
  });

  it('aceita string simples (retrocompatível) e nunca devolve vazio', () => {
    expect(translateAuthError('Invalid login credentials')).toBe('E-mail ou senha incorretos.');
    expect(translateAuthError({ message: '' })).toBe('Não foi possível entrar.');
  });
});

describe('translateDbError', () => {
  it('traduz violação de RLS em mensagem de permissão', () => {
    expect(
      translateDbError({
        code: '42501',
        message: 'new row violates row-level security policy for table "products"',
      }),
    ).toContain('apenas administradores');
  });

  it('traduz constraint de checagem e duplicidade', () => {
    expect(translateDbError({ code: '23514', message: 'check', details: 'comissao <= 100' })).toContain(
      'comissao <= 100',
    );
    expect(translateDbError({ code: '23505', message: 'duplicate key' })).toContain('Já existe');
  });

  it('traduz schema ausente e falha de rede', () => {
    expect(
      translateDbError({ code: 'PGRST205', message: 'Could not find the table public.products' }),
    ).toContain('0001_init.sql');
    expect(translateDbError({ message: 'fetch failed' })).toContain('Não foi possível conectar');
  });
});

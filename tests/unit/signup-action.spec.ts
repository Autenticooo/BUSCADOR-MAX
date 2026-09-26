import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Cadastro público (/cadastro):
 *   - cria o usuário no Supabase Auth;
 *   - garante o perfil em public.users (nasce ativo=false, role='user');
 *   - NUNCA deixa a conta recém-criada navegando logada: se o projeto não
 *     exige confirmação de e-mail, a sessão automática é derrubada;
 *   - devolve ok → a tela mostra "Conta criada. Seu acesso será liberado
 *     após a confirmação da assinatura."
 */
const mocks = vi.hoisted(() => ({
  signUp: vi.fn(),
  signOut: vi.fn(),
  rpc: vi.fn(),
  supabaseEnv: vi.fn(),
}));

vi.mock('@/lib/supabase/env', () => ({ supabaseEnv: mocks.supabaseEnv }));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { signUp: mocks.signUp, signOut: mocks.signOut },
    rpc: mocks.rpc,
  })),
}));

import { signUpAction } from '@/app/actions/auth';

function signupFormData(): FormData {
  const formData = new FormData();
  formData.set('nome', '  Nova Assinante  ');
  formData.set('email', 'Nova@Exemplo.com');
  formData.set('password', 'senha-123');
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.supabaseEnv.mockReturnValue({ configured: true, url: 'https://x', anonKey: 'y' });
  mocks.signUp.mockResolvedValue({
    data: { user: { id: 'user-novo', email: 'nova@exemplo.com' }, session: null },
    error: null,
  });
  mocks.rpc.mockResolvedValue({ error: null });
  mocks.signOut.mockResolvedValue({ error: null });
});

describe('signUpAction', () => {
  it('cria a conta com confirmação de e-mail pendente (sem sessão)', async () => {
    const result = await signUpAction(null, signupFormData());

    expect(result).toEqual({ ok: true, emailConfirmationRequired: true });
    expect(mocks.signUp).toHaveBeenCalledWith({
      email: 'nova@exemplo.com', // normalizado (trim + minúsculas)
      password: 'senha-123',
      options: { data: { nome: 'Nova Assinante' } }, // trimado
    });
    // sem sessão não há como chamar a RPC (auth.uid() é null): o trigger cuida
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it('com sessão automática: garante o perfil e derruba a sessão (paywall)', async () => {
    mocks.signUp.mockResolvedValue({
      data: {
        user: { id: 'user-novo', email: 'nova@exemplo.com' },
        session: { access_token: 'token' },
      },
      error: null,
    });

    const result = await signUpAction(null, signupFormData());

    expect(result).toEqual({ ok: true, emailConfirmationRequired: false });
    expect(mocks.rpc).toHaveBeenCalledWith('ensure_profile', {
      p_id: 'user-novo',
      p_email: 'nova@exemplo.com',
      p_nome: 'Nova Assinante',
    });
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
  });

  it('devolve erro amigável quando o e-mail já está cadastrado', async () => {
    mocks.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'User already registered', status: 422 },
    });

    const result = await signUpAction(null, signupFormData());

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.error).toBe('Este e-mail já está cadastrado. Use a tela de login para entrar.');
    }
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it('valida os campos antes de chamar o Supabase', async () => {
    const formData = new FormData();
    formData.set('nome', 'A');
    formData.set('email', 'nao-e-um-email');
    formData.set('password', '123');

    const result = await signUpAction(null, formData);

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.error).toBe('Verifique os campos destacados.');
      expect(result.fieldErrors?.nome).toBeTruthy();
      expect(result.fieldErrors?.email).toBeTruthy();
      expect(result.fieldErrors?.password).toBe('Mínimo de 6 caracteres');
    }
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it('avisa quando o Supabase não está configurado', async () => {
    mocks.supabaseEnv.mockReturnValue({ configured: false });

    const result = await signUpAction(null, signupFormData());

    expect(result.ok).toBe(false);
    if (result.ok === false) expect(result.error).toContain('Supabase não configurado');
    expect(mocks.signUp).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Login: depois de autenticar no Supabase Auth, a action consulta
 * public.users e aplica o paywall:
 *   - role = 'admin'                    → entra (mesmo com ativo = false)
 *   - ativo = true                      → entra
 *   - ativo = false (usuário comum)     → sessão derrubada + mensagem
 */
const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  getUser: vi.fn(),
  signOut: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
  supabaseEnv: vi.fn(),
  redirect: vi.fn((url: string) => {
    const error = new Error(`NEXT_REDIRECT ${url}`) as Error & { digest?: string };
    error.digest = `NEXT_REDIRECT;replace;${url};307;`;
    throw error;
  }),
}));

vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));

vi.mock('@/lib/supabase/env', () => ({ supabaseEnv: mocks.supabaseEnv }));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      signInWithPassword: mocks.signInWithPassword,
      getUser: mocks.getUser,
      signOut: mocks.signOut,
    },
    rpc: mocks.rpc,
    from: mocks.from,
  })),
}));

import { signInAction } from '@/app/actions/auth';
import { SUBSCRIPTION_REQUIRED_MESSAGE } from '@/lib/constants';

function loginFormData(next = '/produtos'): FormData {
  const formData = new FormData();
  formData.set('email', 'Assinante@Exemplo.com');
  formData.set('password', 'senha-secreta');
  formData.set('next', next);
  return formData;
}

function mockProfileSelect(profile: { role: string; ativo: boolean } | null) {
  mocks.maybeSingle.mockResolvedValue({ data: profile, error: null });
  mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
  mocks.select.mockReturnValue({ eq: mocks.eq });
  mocks.from.mockReturnValue({ select: mocks.select });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.supabaseEnv.mockReturnValue({ configured: true, url: 'https://x', anonKey: 'y' });
  mocks.signInWithPassword.mockResolvedValue({ error: null });
  mocks.getUser.mockResolvedValue({
    data: { user: { id: 'user-1', email: 'assinante@exemplo.com' } },
  });
  mocks.rpc.mockResolvedValue({ error: null });
  mocks.signOut.mockResolvedValue({ error: null });
  mockProfileSelect({ role: 'user', ativo: true });
});

describe('signInAction — paywall', () => {
  it('bloqueia usuário comum sem assinatura ativa e derruba a sessão', async () => {
    mockProfileSelect({ role: 'user', ativo: false });

    const result = await signInAction(null, loginFormData());

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.error).toBe(SUBSCRIPTION_REQUIRED_MESSAGE);
      expect(result.error).toContain('assinatura ativa');
    }
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it('libera usuário comum com assinatura ativa, respeitando o next', async () => {
    await expect(signInAction(null, loginFormData())).rejects.toThrow('NEXT_REDIRECT');

    expect(mocks.redirect).toHaveBeenCalledWith('/produtos');
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it('libera admin mesmo com ativo = false', async () => {
    mockProfileSelect({ role: 'admin', ativo: false });

    await expect(signInAction(null, loginFormData())).rejects.toThrow('NEXT_REDIRECT');

    expect(mocks.redirect).toHaveBeenCalledWith('/produtos');
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it('protege contra open redirect no parâmetro next', async () => {
    await expect(signInAction(null, loginFormData('https://evil.com'))).rejects.toThrow(
      'NEXT_REDIRECT',
    );

    expect(mocks.redirect).toHaveBeenCalledWith('/dashboard');
  });

  it('devolve erro amigável para credenciais inválidas (sem checar perfil)', async () => {
    mocks.signInWithPassword.mockResolvedValue({
      error: { name: 'AuthInvalidCredentialsError', message: 'Invalid login credentials', status: 400 },
    });

    const result = await signInAction(null, loginFormData());

    expect(result.ok).toBe(false);
    if (result.ok === false) expect(result.error).toBe('E-mail ou senha incorretos.');
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it('valida os campos antes de chamar o Supabase', async () => {
    const formData = new FormData();
    formData.set('email', 'nao-e-um-email');
    formData.set('password', '');

    const result = await signInAction(null, formData);

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.error).toBe('Verifique os campos destacados.');
      expect(result.fieldErrors?.email).toBeTruthy();
    }
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
  });

  it('avisa quando o Supabase não está configurado', async () => {
    mocks.supabaseEnv.mockReturnValue({ configured: false });

    const result = await signInAction(null, loginFormData());

    expect(result.ok).toBe(false);
    if (result.ok === false) expect(result.error).toContain('Supabase não configurado');
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
  });
});

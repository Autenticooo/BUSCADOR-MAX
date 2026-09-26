import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * O layout do grupo (app) é o portão da área de membros: conta logada sem
 * assinatura ativa (ativo = false) vê <SubscriptionRequired /> e NENHUM
 * conteúdo interno — nem o AppShell. Admin entra mesmo com ativo = false.
 */
const mocks = vi.hoisted(() => ({
  requireProfile: vi.fn(),
  supabaseEnv: vi.fn(),
}));

vi.mock('@/lib/session', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/session')>();
  return { ...original, requireProfile: mocks.requireProfile };
});

vi.mock('@/lib/supabase/env', () => ({ supabaseEnv: mocks.supabaseEnv }));

vi.mock('@/components/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) =>
    createElement('div', null, createElement('span', null, 'APPSHELL'), children),
}));

import AppLayout from '@/app/(app)/layout';

const baseProfile = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'assinante@exemplo.com',
  nome: 'Assinante',
  role: 'user' as const,
  ativo: true,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
};

const appChildren = createElement('p', null, 'CONTEUDO-PRIVADO');

beforeEach(() => {
  vi.clearAllMocks();
  mocks.supabaseEnv.mockReturnValue({ configured: true, url: 'https://x', anonKey: 'y' });
  mocks.requireProfile.mockResolvedValue(baseProfile);
});

describe('AppLayout (paywall)', () => {
  it('bloqueia usuário comum com ativo = false e não renderiza o conteúdo', async () => {
    mocks.requireProfile.mockResolvedValue({ ...baseProfile, ativo: false });

    const html = renderToStaticMarkup(await AppLayout({ children: appChildren }));

    expect(html).toContain('Assinatura ativa necessária');
    expect(html).toContain('assinante@exemplo.com');
    expect(html).not.toContain('APPSHELL');
    expect(html).not.toContain('CONTEUDO-PRIVADO');
  });

  it('libera usuário comum com assinatura ativa', async () => {
    const html = renderToStaticMarkup(await AppLayout({ children: appChildren }));

    expect(html).toContain('APPSHELL');
    expect(html).toContain('CONTEUDO-PRIVADO');
    expect(html).not.toContain('Assinatura ativa necessária');
  });

  it('libera admin mesmo com ativo = false', async () => {
    mocks.requireProfile.mockResolvedValue({ ...baseProfile, role: 'admin', ativo: false });

    const html = renderToStaticMarkup(await AppLayout({ children: appChildren }));

    expect(html).toContain('APPSHELL');
    expect(html).toContain('CONTEUDO-PRIVADO');
  });

  it('mostra a tela de setup quando o Supabase não está configurado', async () => {
    mocks.supabaseEnv.mockReturnValue({ configured: false });

    const html = renderToStaticMarkup(await AppLayout({ children: appChildren }));

    expect(html).toContain('Conecte seu projeto Supabase');
    expect(mocks.requireProfile).not.toHaveBeenCalled();
  });
});

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * /admin e /admin/produtos/novo não podem mais responder 404 para assinante
 * comum: o layout mostra <AdminAccessDenied /> e o conteúdo administrativo
 * nunca é renderizado.
 */
const mocks = vi.hoisted(() => ({
  getCurrentProfile: vi.fn(),
  redirect: vi.fn((url: string) => {
    const error = new Error(`NEXT_REDIRECT ${url}`) as Error & { digest?: string };
    error.digest = `NEXT_REDIRECT;replace;${url};307;`;
    throw error;
  }),
}));

vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));

vi.mock('@/lib/session', () => ({ getCurrentProfile: mocks.getCurrentProfile }));

import AdminLayout from '@/app/(app)/admin/layout';

const baseProfile = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'assinante@exemplo.com',
  nome: 'Assinante',
  role: 'user' as const,
  ativo: true,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
};

const adminChildren = createElement('p', null, 'CONTEUDO-ADMIN');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AdminLayout', () => {
  it('mostra o aviso de acesso negado em vez de 404 para quem não é admin', async () => {
    mocks.getCurrentProfile.mockResolvedValue(baseProfile);

    const html = renderToStaticMarkup(await AdminLayout({ children: adminChildren }));

    expect(html).toContain('Acesso de administrador necessário');
    expect(html).toContain('assinante@exemplo.com');
    expect(html).not.toContain('CONTEUDO-ADMIN');
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it('redireciona para /login quando não há sessão', async () => {
    mocks.getCurrentProfile.mockResolvedValue(null);

    await expect(AdminLayout({ children: adminChildren })).rejects.toThrow('NEXT_REDIRECT');
    expect(mocks.redirect).toHaveBeenCalledWith('/login');
  });

  it('libera o conteúdo para administradores', async () => {
    mocks.getCurrentProfile.mockResolvedValue({ ...baseProfile, role: 'admin' });

    const html = renderToStaticMarkup(await AdminLayout({ children: adminChildren }));

    expect(html).toContain('CONTEUDO-ADMIN');
    expect(html).not.toContain('Acesso de administrador necessário');
  });
});

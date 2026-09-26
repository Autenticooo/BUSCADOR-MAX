import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Regras de rota do middleware:
 *
 *   /api/* (webhook Kiwify, health)  -> SEMPRE liberado: nenhum redirect,
 *                                       nem sem sessão (→ /login) nem com
 *                                       sessão (→ /dashboard)
 *   dashboard/produtos/favoritos/perfil (e demais páginas) sem sessão
 *                                    -> 307 para /login (com ?next=...)
 *   /login e /cadastro               -> públicos
 *   sessão ativa em rota pública ou / -> 307 para /dashboard
 */
const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock('@supabase/ssr', () => ({ createServerClient: mocks.createServerClient }));

vi.mock('@/lib/supabase/env', () => ({
  supabaseEnv: () => ({ configured: true, url: 'https://x.supabase.co', anonKey: 'y' }),
}));

import { updateSession } from '@/lib/supabase/middleware';

function req(path: string, method = 'GET') {
  return new NextRequest(`http://localhost:3000${path}`, { method });
}

function asAnonymous() {
  mocks.getUser.mockResolvedValue({ data: { user: null } });
}

function asLoggedIn() {
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
}

/** redirect? → [status, location]; pass-through → [200, null] */
function redirectTarget(location: string | null) {
  return location ? new URL(location).pathname : null;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createServerClient.mockReturnValue({ auth: { getUser: mocks.getUser } });
  asAnonymous();
});

describe('rotas de API — nunca redirecionam', () => {
  it('webhook da Kiwify SEM sessão: passa direto (não vai para /login)', async () => {
    const res = await updateSession(req('/api/webhook/kiwify', 'POST'));

    expect(res.status).toBe(200);
    expect(redirectTarget(res.headers.get('location'))).toBeNull();
  });

  it('webhook da Kiwify COM sessão: passa direto (não vai para /dashboard)', async () => {
    // era este o bug: um POST ao webhook partindo de um navegador logado
    // recebia 302 → /dashboard
    asLoggedIn();

    const res = await updateSession(req('/api/webhook/kiwify', 'POST'));

    expect(res.status).toBe(200);
    expect(redirectTarget(res.headers.get('location'))).toBeNull();
  });

  it('/api/health sem sessão: passa direto', async () => {
    const res = await updateSession(req('/api/health'));

    expect(res.status).toBe(200);
    expect(redirectTarget(res.headers.get('location'))).toBeNull();
  });
});

describe('páginas privadas — exigem sessão', () => {
  it.each(['/dashboard', '/produtos', '/produtos/abc-123', '/favoritos', '/perfil'])(
    '%s sem sessão → /login',
    async (path) => {
      const res = await updateSession(req(path));

      expect(res.status).toBe(307);
      expect(redirectTarget(res.headers.get('location'))).toBe('/login');
    },
  );

  it('preserva o destino em ?next= para voltar depois do login', async () => {
    const res = await updateSession(req('/produtos'));

    expect(res.headers.get('location')).toContain('next=%2Fprodutos');
  });

  it.each(['/dashboard', '/produtos', '/favoritos', '/perfil'])(
    '%s com sessão → liberado',
    async (path) => {
      asLoggedIn();

      const res = await updateSession(req(path));

      expect(res.status).toBe(200);
      expect(redirectTarget(res.headers.get('location'))).toBeNull();
    },
  );
});

describe('páginas públicas', () => {
  it.each(['/login', '/cadastro'])('%s sem sessão → liberada', async (path) => {
    const res = await updateSession(req(path));

    expect(res.status).toBe(200);
    expect(redirectTarget(res.headers.get('location'))).toBeNull();
  });

  it.each(['/login', '/cadastro'])('%s com sessão → /dashboard', async (path) => {
    asLoggedIn();

    const res = await updateSession(req(path));

    expect(res.status).toBe(307);
    expect(redirectTarget(res.headers.get('location'))).toBe('/dashboard');
  });
});

describe('raiz', () => {
  it('/ sem sessão → /login', async () => {
    const res = await updateSession(req('/'));

    expect(res.status).toBe(307);
    expect(redirectTarget(res.headers.get('location'))).toBe('/login');
  });

  it('/ com sessão → /dashboard', async () => {
    asLoggedIn();

    const res = await updateSession(req('/'));

    expect(res.status).toBe(307);
    expect(redirectTarget(res.headers.get('location'))).toBe('/dashboard');
  });
});

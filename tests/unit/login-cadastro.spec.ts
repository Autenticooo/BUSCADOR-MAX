import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

/**
 * As páginas públicas de autenticação precisam se interligar:
 *   /login    → link "Ainda não possui conta? Criar conta" para /cadastro
 *   /cadastro → formulário nome/e-mail/senha + link "Entrar" para /login
 */
vi.mock('@/lib/supabase/env', () => ({
  supabaseEnv: () => ({ configured: true, url: 'https://x', anonKey: 'y' }),
}));

import LoginPage from '@/app/login/page';
import CadastroPage from '@/app/cadastro/page';

describe('/login', () => {
  it('oferece o link "Criar conta" apontando para /cadastro', async () => {
    const html = renderToStaticMarkup(
      await LoginPage({ searchParams: Promise.resolve({}) }),
    );

    expect(html).toContain('Ainda não possui conta?');
    expect(html).toContain('Criar conta');
    expect(html).toContain('href="/cadastro"');
    // o formulário de login continua intacto
    expect(html).toContain('name="email"');
    expect(html).toContain('name="password"');
  });
});

describe('/cadastro', () => {
  it('renderiza o formulário com nome, e-mail e senha + link de volta ao login', () => {
    const html = renderToStaticMarkup(CadastroPage());

    expect(html).toContain('Criar conta');
    expect(html).toContain('name="nome"');
    expect(html).toContain('name="email"');
    expect(html).toContain('name="password"');
    expect(html).toContain('href="/login"');
    // paywall avisado já no formulário
    expect(html).toContain('assinatura');
  });
});

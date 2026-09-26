// @vitest-environment jsdom
import { createElement } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Após o cadastro a tela NÃO loga o usuário: mostra a mensagem
 * "Conta criada. Seu acesso será liberado após a confirmação da assinatura."
 * (o perfil nasce com ativo = false).
 */
const mocks = vi.hoisted(() => ({ signUpAction: vi.fn() }));

vi.mock('@/app/actions/auth', () => ({ signUpAction: mocks.signUpAction }));

import { SignupForm } from '@/app/cadastro/signup-form';
import { ACCOUNT_CREATED_MESSAGE } from '@/lib/constants';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
  globalThis.IS_REACT_ACT_ENVIRONMENT = undefined;
});

function field(name: string) {
  return container.querySelector<HTMLInputElement>(`[name="${name}"]`);
}

async function renderForm() {
  await act(async () => {
    root.render(createElement(SignupForm));
  });

  const form = container.querySelector('form');
  if (!form) throw new Error('formulário não renderizado');
  return form;
}

async function submit(form: HTMLFormElement) {
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    // deixa a transição (e o await da server action) concluir
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('SignupForm', () => {
  it('mostra a mensagem de conta criada e o link para o login após o cadastro', async () => {
    mocks.signUpAction.mockResolvedValue({ ok: true, emailConfirmationRequired: false });

    const form = await renderForm();
    Object.assign(field('nome')!, { value: 'Nova Assinante' });
    Object.assign(field('email')!, { value: 'nova@exemplo.com' });
    Object.assign(field('password')!, { value: 'senha-123' });

    await submit(form);

    expect(mocks.signUpAction).toHaveBeenCalledTimes(1);

    // o formulário some e dá lugar à confirmação com a mensagem exigida
    expect(container.querySelector('form')).toBeNull();
    expect(container.textContent).toContain(ACCOUNT_CREATED_MESSAGE);
    const linkLogin = container.querySelector<HTMLAnchorElement>('a[href="/login"]');
    expect(linkLogin?.textContent).toContain('Ir para o login');
  });

  it('avisa sobre a confirmação de e-mail quando o projeto a exige', async () => {
    mocks.signUpAction.mockResolvedValue({ ok: true, emailConfirmationRequired: true });

    const form = await renderForm();
    Object.assign(field('nome')!, { value: 'Nova Assinante' });
    Object.assign(field('email')!, { value: 'nova@exemplo.com' });
    Object.assign(field('password')!, { value: 'senha-123' });

    await submit(form);

    expect(container.textContent).toContain(ACCOUNT_CREATED_MESSAGE);
    expect(container.textContent).toContain('e-mail de confirmação');
  });

  it('mantém o formulário visível com o erro devolvido pela action', async () => {
    mocks.signUpAction.mockResolvedValue({
      ok: false,
      error: 'Este e-mail já está cadastrado. Use a tela de login para entrar.',
    });

    const form = await renderForm();
    Object.assign(field('email')!, { value: 'ja@exemplo.com' });

    await submit(form);

    // o formulário NÃO é trocado pela tela de sucesso e o erro aparece nele.
    // (React 19 reseta os campos após a action — mesmo comportamento do login.)
    expect(container.querySelector('form')).not.toBeNull();
    expect(container.textContent).toContain('Este e-mail já está cadastrado.');
  });
});

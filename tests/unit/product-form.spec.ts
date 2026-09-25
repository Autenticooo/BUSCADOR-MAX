// @vitest-environment jsdom
import { createElement } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Regressão do erro em /admin/produtos/novo:
 *
 *   Uncaught TypeError: Cannot read properties of null (reading 'reset')
 *
 * O submit do formulário roda dentro de startTransition (assíncrono) e o React
 * anula `event.currentTarget` assim que o handler síncrono termina. O
 * componente precisa guardar a referência do <form> antes.
 */
const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  createProductAction: vi.fn(),
  updateProductAction: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

vi.mock('@/app/actions/products', () => ({
  createProductAction: mocks.createProductAction,
  updateProductAction: mocks.updateProductAction,
}));

import { ProductForm } from '@/components/product-form';

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
  return container.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    `[name="${name}"]`,
  );
}

async function renderForm() {
  await act(async () => {
    root.render(createElement(ProductForm));
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

describe('ProductForm', () => {
  it('limpa o formulário depois de cadastrar, sem estourar em event.currentTarget', async () => {
    mocks.createProductAction.mockResolvedValue({
      ok: true,
      message: 'Produto cadastrado com sucesso.',
    });

    const form = await renderForm();

    // usuário preenche o cadastro
    Object.assign(field('nome')!, { value: 'Sérum Vitamina C' });
    Object.assign(field('categoria')!, { value: 'Beleza' });
    Object.assign(field('pais')!, { value: 'BR' });

    await submit(form);

    expect(mocks.createProductAction).toHaveBeenCalledTimes(1);
    // era exatamente aqui que o TypeError interrompia a limpeza do formulário
    expect(field('nome')!.value).toBe('');
    expect(field('categoria')!.value).toBe('');
    expect(container.textContent).toContain('Formulário limpo');
    expect(container.textContent).toContain('Produto cadastrado com sucesso.');
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it('preserva os dados digitados quando a action devolve erro', async () => {
    mocks.createProductAction.mockResolvedValue({
      ok: false,
      error: 'Verifique os campos destacados.',
      fieldErrors: { nome: 'Informe o nome do produto.' },
    });

    const form = await renderForm();
    Object.assign(field('nome')!, { value: 'Produto inválido' });

    await submit(form);

    expect(field('nome')!.value).toBe('Produto inválido');
    expect(container.textContent).toContain('Informe o nome do produto.');
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});

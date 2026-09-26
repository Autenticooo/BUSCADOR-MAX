// @vitest-environment jsdom
import { createElement } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AppError from '@/app/(app)/error';

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
  globalThis.IS_REACT_ACT_ENVIRONMENT = undefined;
  vi.restoreAllMocks();
});

describe('AppError', () => {
  it('oferece recuperação sem pedir que o usuário repita um cadastro', async () => {
    const error = new Error('falha ao atualizar a árvore RSC');
    const reset = vi.fn();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await act(async () => {
      root.render(createElement(AppError, { error, reset }));
    });

    expect(container.textContent).toContain('Não foi possível atualizar esta página');
    expect(container.textContent).toContain('A operação pode ter sido concluída no servidor.');
    expect(container.textContent).toContain('Tentar novamente');
    expect(container.querySelector('a[href="/dashboard"]')).not.toBeNull();
    expect(consoleError).toHaveBeenCalledWith('[app error]', error);
  });

  it('chama reset ao tentar carregar a página novamente', async () => {
    const reset = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await act(async () => {
      root.render(createElement(AppError, { error: new Error('falha'), reset }));
    });

    const button = container.querySelector('button');
    if (!button) throw new Error('botão de recuperação não renderizado');

    await act(async () => {
      button.click();
    });

    expect(reset).toHaveBeenCalledTimes(1);
  });
});

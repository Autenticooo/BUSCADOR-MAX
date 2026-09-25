import { describe, expect, it } from 'vitest';

import {
  fieldErrorsFrom,
  loginSchema,
  productSchema,
  profileSchema,
} from '@/lib/validators';
import { sanitizeSearchTerm } from '@/lib/products';
import { formatCompact, formatMoney, formatPercent, toNumber, truncate } from '@/lib/format';

const produtoValido = {
  nome: 'Sérum Facial Vitamina C 30ml',
  imagem: 'https://cdn.exemplo.com/a.jpg',
  categoria: 'Beleza e Cuidados',
  descricao: 'Sérum antioxidante',
  link_tiktok: 'https://shop.tiktok.com/view/product/123',
  pais: 'BR',
  preco: '89.90',
  comissao: '20',
  gvm_max: '480000',
  videos_criadores: '412',
  quantidade_criadores: '168',
  max_score: '',
  status: 'em_alta',
  estrategia: 'Antes e depois',
};

describe('productSchema', () => {
  it('aceita um cadastro completo vindo de FormData (tudo string)', () => {
    const parsed = productSchema.safeParse(produtoValido);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    expect(parsed.data.preco).toBe(89.9);
    expect(parsed.data.gvm_max).toBe(480_000);
    expect(parsed.data.videos_criadores).toBe(412);
    // campo vazio => null => o trigger do banco calcula o score
    expect(parsed.data.max_score).toBeNull();
    expect(parsed.data.status).toBe('em_alta');
  });

  it('exige nome e rejeita nome curto', () => {
    const parsed = productSchema.safeParse({ ...produtoValido, nome: 'A' });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(fieldErrorsFrom(parsed.error).nome).toContain('2 caracteres');
  });

  it('rejeita categoria/país vazios', () => {
    const parsed = productSchema.safeParse({ ...produtoValido, categoria: '', pais: '  ' });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const errors = fieldErrorsFrom(parsed.error);
    expect(errors.categoria).toBeTruthy();
    expect(errors.pais).toBeTruthy();
  });

  it('rejeita URL inválida em imagem e link, mas aceita vazio', () => {
    const invalido = productSchema.safeParse({
      ...produtoValido,
      link_tiktok: 'shop.tiktok.com/produto',
    });
    expect(invalido.success).toBe(false);
    if (!invalido.success) {
      expect(fieldErrorsFrom(invalido.error).link_tiktok).toContain('URL válida');
    }

    const vazio = productSchema.safeParse({ ...produtoValido, link_tiktok: '', imagem: '' });
    expect(vazio.success).toBe(true);
    if (vazio.success) {
      expect(vazio.data.link_tiktok).toBeNull();
      expect(vazio.data.imagem).toBeNull();
    }
  });

  it('rejeita comissão acima de 100% e valores negativos', () => {
    const comissao = productSchema.safeParse({ ...produtoValido, comissao: '180' });
    expect(comissao.success).toBe(false);

    const negativo = productSchema.safeParse({ ...produtoValido, gvm_max: '-10' });
    expect(negativo.success).toBe(false);
  });

  it('rejeita status fora da lista', () => {
    const parsed = productSchema.safeParse({ ...produtoValido, status: 'sumido' });
    expect(parsed.success).toBe(false);
  });

  it('limita max_score manual entre 0 e 100', () => {
    expect(productSchema.safeParse({ ...produtoValido, max_score: '120' }).success).toBe(false);
    expect(productSchema.safeParse({ ...produtoValido, max_score: '-5' }).success).toBe(false);
    expect(productSchema.safeParse({ ...produtoValido, max_score: '77.5' }).success).toBe(true);
  });

  it('aplica default de status ativo', () => {
    const { status: _omitido, ...semStatus } = produtoValido;
    const parsed = productSchema.safeParse(semStatus);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.status).toBe('ativo');
  });
});

describe('loginSchema', () => {
  it('normaliza o e-mail para minúsculas', () => {
    const parsed = loginSchema.safeParse({ email: '  Admin@BuscadorMax.COM ', password: 'x' });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.email).toBe('admin@buscadormax.com');
  });

  it('rejeita e-mail inválido e senha vazia', () => {
    expect(loginSchema.safeParse({ email: 'nao-é-email', password: '123' }).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
  });
});

describe('profileSchema', () => {
  it('exige pelo menos 2 caracteres no nome', () => {
    expect(profileSchema.safeParse({ nome: 'A' }).success).toBe(false);
    expect(profileSchema.safeParse({ nome: 'Ana' }).success).toBe(true);
  });
});

describe('sanitizeSearchTerm', () => {
  it('remove curingas e vírgulas que quebrariam o .or() do PostgREST', () => {
    expect(sanitizeSearchTerm('sérum, (vitamina) 100% _c_ \\')).toBe('sérum vitamina 100 c');
    expect(sanitizeSearchTerm('   ')).toBe('');
  });
});

/** o ICU separa símbolo e valor com espaço não separável */
const norm = (value: string) => value.replace(/[\u00A0\u202F\u2009]/g, ' ');

describe('formatadores', () => {
  it('toNumber aceita número, string e valores inválidos', () => {
    expect(toNumber(12.5)).toBe(12.5);
    expect(toNumber('12.5')).toBe(12.5);
    expect(toNumber('1.234,56'.replace(/\./g, ''))).toBe(1234.56);
    expect(toNumber(null)).toBe(0);
    expect(toNumber('abc')).toBe(0);
  });

  it('formata moeda conforme o país do produto', () => {
    expect(norm(formatMoney(89.9, 'BR'))).toBe('R$ 89,90');
    expect(norm(formatMoney(24.99, 'US'))).toBe('$24.99');
    expect(norm(formatMoney(10, null))).toBe('R$ 10,00');
  });

  it('formata números compactos e percentuais', () => {
    expect(norm(formatCompact(1_234_567))).toBe('1,2 mi');
    expect(norm(formatCompact(12_345))).toBe('12,3 mil');
    expect(norm(formatCompact(800))).toBe('800');
    expect(formatPercent(20, 0)).toBe('20%');
  });

  it('trunca textos longos sem cortar palavras', () => {
    const texto = 'Produto incrível para criadores de conteúdo no TikTok Shop';
    expect(truncate(texto, 20)).toBe('Produto incrível…');
    expect(truncate(texto, 200)).toBe(texto);
    expect(truncate(null)).toBe('');
  });
});

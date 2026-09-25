import { describe, expect, it } from 'vitest';

import { buildProductHref, parseFilters } from '@/lib/params';
import { SCORE_LIMITS, SCORE_WEIGHTS, calcularMaxScore, scoreBand } from '@/lib/score';

describe('calcularMaxScore', () => {
  it('pesos somam 100 e os tetos são os documentados', () => {
    expect(
      SCORE_WEIGHTS.gvm + SCORE_WEIGHTS.videos + SCORE_WEIGHTS.criadores,
    ).toBe(100);
    expect(SCORE_LIMITS).toEqual({ gvm: 500_000, videos: 500, criadores: 200 });
  });

  it('retorna 0 quando não há métricas', () => {
    expect(calcularMaxScore({})).toBe(0);
    expect(calcularMaxScore({ gvm_max: 0, videos_criadores: 0, quantidade_criadores: 0 })).toBe(0);
  });

  it('aplica 40/30/30 com teto em cada componente', () => {
    expect(
      calcularMaxScore({ gvm_max: 250_000, videos_criadores: 250, quantidade_criadores: 100 }),
    ).toBe(50);

    expect(
      calcularMaxScore({ gvm_max: 500_000, videos_criadores: 500, quantidade_criadores: 200 }),
    ).toBe(100);

    // acima do teto não passa de 100
    expect(
      calcularMaxScore({ gvm_max: 5_000_000, videos_criadores: 5_000, quantidade_criadores: 2_000 }),
    ).toBe(100);
  });

  it('aceita valores vindos do PostgREST como string', () => {
    expect(
      calcularMaxScore({
        gvm_max: '125000',
        videos_criadores: '125',
        quantidade_criadores: '50',
      }),
    ).toBe(25);
  });

  it('não devolve score negativo com entrada inválida', () => {
    expect(calcularMaxScore({ gvm_max: -999, videos_criadores: -10 })).toBe(0);
    expect(calcularMaxScore({ gvm_max: 'abc' })).toBe(0);
  });

  it('classifica as faixas do score', () => {
    expect(scoreBand(95).label).toBe('Explosivo');
    expect(scoreBand(70).label).toBe('Alto potencial');
    expect(scoreBand(45).label).toBe('Médio potencial');
    expect(scoreBand(10).label).toBe('Baixo potencial');
    expect(scoreBand(null).label).toBe('Baixo potencial');
  });
});

describe('parseFilters', () => {
  it('ignora parâmetros vazios', () => {
    expect(parseFilters({ q: '', categoria: '  ', page: '' })).toEqual({});
  });

  it('converte page em número e mantém os demais como string', () => {
    expect(
      parseFilters({ q: 'serum', categoria: 'Beleza e Cuidados', page: '3' }),
    ).toEqual({ q: 'serum', categoria: 'Beleza e Cuidados', page: 3 });
  });

  it('descarta apenas o campo inválido, mantendo os válidos', () => {
    const result = parseFilters({ q: 'fone', pais: 'INVALIDO', status: 'em_alta' });
    expect(result.q).toBe('fone');
    expect(result.status).toBe('em_alta');
    expect(result.pais).toBeUndefined();
  });

  it('aceita array (searchParams duplicado) usando o primeiro valor', () => {
    expect(parseFilters({ pais: ['BR', 'US'] })).toEqual({ pais: 'BR' });
  });
});

describe('buildProductHref', () => {
  it('omite valores padrão e página 1', () => {
    expect(buildProductHref({ sort: 'recentes', page: 1, view: 'tabela' })).toBe('/produtos');
  });

  it('preserva filtros ao paginar', () => {
    const href = buildProductHref(
      { q: 'serum', categoria: 'Beleza e Cuidados', pais: 'BR', sort: 'gvm_desc' },
      { page: 4 },
    );
    const params = new URL(`http://x${href}`).searchParams;
    expect(params.get('q')).toBe('serum');
    expect(params.get('categoria')).toBe('Beleza e Cuidados');
    expect(params.get('pais')).toBe('BR');
    expect(params.get('sort')).toBe('gvm_desc');
    expect(params.get('page')).toBe('4');
  });

  it('usa o basePath informado (favoritos e admin)', () => {
    expect(buildProductHref({}, { page: 2 }, '/favoritos')).toBe('/favoritos?page=2');
    expect(buildProductHref({}, { page: 2 }, '/admin')).toBe('/admin?page=2');
  });
});

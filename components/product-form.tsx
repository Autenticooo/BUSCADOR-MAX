'use client';

import { Loader2, Save, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { createProductAction, updateProductAction } from '@/app/actions/products';
import { CATEGORIAS, PAISES, STATUS_LIST } from '@/lib/constants';
import { calcularMaxScore, scoreBand } from '@/lib/score';
import type { ActionResult, Product } from '@/lib/types';

export function ProductForm({ product }: { product?: Product }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [savedId, setSavedId] = useState<string | null>(null);

  // preview do MAX SCORE em tempo real
  const [metrics, setMetrics] = useState({
    gvm_max: product?.gvm_max ?? 0,
    videos_criadores: product?.videos_criadores ?? 0,
    quantidade_criadores: product?.quantidade_criadores ?? 0,
  });
  const [manualScore, setManualScore] = useState(
    product?.max_score !== null && product?.max_score !== undefined
      ? String(product.max_score)
      : '',
  );

  const previewScore =
    manualScore.trim() === ''
      ? calcularMaxScore(metrics)
      : Number(manualScore.replace(',', '.')) || 0;
  const band = scoreBand(previewScore);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // O React anula `event.currentTarget` quando o handler síncrono termina,
    // e o trabalho abaixo continua dentro de startTransition (async). Guardar
    // o <form> aqui evita o
    //   "Cannot read properties of null (reading 'reset')".
    const form = event.currentTarget;
    const formData = new FormData(form);

    setResult(null);
    setFieldErrors({});

    startTransition(async () => {
      const action = product
        ? updateProductAction(product.id, formData)
        : createProductAction(formData);

      const response = await action;
      setResult(response);

      if (!response.ok) {
        setFieldErrors(response.fieldErrors ?? {});
        return;
      }

      if (product) {
        router.push('/admin');
        router.refresh();
      } else {
        setSavedId('new');
        // `form` (capturado acima) em vez de event.currentTarget, que já é null.
        form.reset();
        setMetrics({ gvm_max: 0, videos_criadores: 0, quantidade_criadores: 0 });
        setManualScore('');
        router.refresh();
      }
    });
  }

  const error = (field: string) =>
    fieldErrors[field] ? (
      <p className="mt-1 text-xs text-brand-pink">{fieldErrors[field]}</p>
    ) : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="panel space-y-5 p-5">
        <SectionTitle
          step="1"
          title="Identificação"
          hint="Dados básicos exibidos na listagem e no detalhe"
        />

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nome do produto *" error={error('nome')} className="md:col-span-2">
            <input
              name="nome"
              required
              defaultValue={product?.nome ?? ''}
              placeholder="Ex.: Sérum Facial Vitamina C 30ml"
              className="field"
            />
          </Field>

          <Field label="URL da imagem" error={error('imagem')} className="md:col-span-2">
            <input
              name="imagem"
              type="url"
              defaultValue={product?.imagem ?? ''}
              placeholder="https://…"
              className="field"
            />
          </Field>

          <Field label="Categoria *" error={error('categoria')}>
            <select name="categoria" required defaultValue={product?.categoria ?? ''} className="field">
              <option value="">Selecione…</option>
              {CATEGORIAS.map((categoria) => (
                <option key={categoria} value={categoria}>
                  {categoria}
                </option>
              ))}
            </select>
          </Field>

          <Field label="País *" error={error('pais')}>
            <select name="pais" required defaultValue={product?.pais ?? ''} className="field">
              <option value="">Selecione…</option>
              {PAISES.map((pais) => (
                <option key={pais.code} value={pais.code}>
                  {pais.label} ({pais.code})
                </option>
              ))}
            </select>
          </Field>

          <Field label="Link TikTok Shop" error={error('link_tiktok')} className="md:col-span-2">
            <input
              name="link_tiktok"
              type="url"
              defaultValue={product?.link_tiktok ?? ''}
              placeholder="https://shop.tiktok.com/…"
              className="field"
            />
          </Field>

          <Field
            label="Descrição"
            error={error('descricao')}
            hint="O que é o produto e por que ele vende"
            className="md:col-span-2"
          >
            <textarea
              name="descricao"
              rows={4}
              defaultValue={product?.descricao ?? ''}
              className="field resize-y"
            />
          </Field>
        </div>
      </div>

      <div className="panel space-y-5 p-5">
        <SectionTitle
          step="2"
          title="Métricas TikTok Shop"
          hint="GVM Max, vídeos e criadores alimentam o MAX SCORE"
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Field label="Preço" error={error('preco')}>
            <input
              name="preco"
              type="number"
              step="0.01"
              min="0"
              defaultValue={product?.preco ?? 0}
              className="field tabular-nums"
            />
          </Field>

          <Field label="Comissão (%)" error={error('comissao')}>
            <input
              name="comissao"
              type="number"
              step="0.1"
              min="0"
              max="100"
              defaultValue={product?.comissao ?? 0}
              className="field tabular-nums"
            />
          </Field>

          <Field
            label="GVM Max (US$)"
            error={error('gvm_max')}
            hint="Peso 40% do score"
          >
            <input
              name="gvm_max"
              type="number"
              step="0.01"
              min="0"
              defaultValue={product?.gvm_max ?? 0}
              onChange={(event) =>
                setMetrics((prev) => ({
                  ...prev,
                  gvm_max: Number(event.target.value) || 0,
                }))
              }
              className="field tabular-nums"
            />
          </Field>

          <Field
            label="Vídeos de criadores"
            error={error('videos_criadores')}
            hint="Peso 30% do score"
          >
            <input
              name="videos_criadores"
              type="number"
              step="1"
              min="0"
              defaultValue={product?.videos_criadores ?? 0}
              onChange={(event) =>
                setMetrics((prev) => ({
                  ...prev,
                  videos_criadores: Number(event.target.value) || 0,
                }))
              }
              className="field tabular-nums"
            />
          </Field>

          <Field
            label="Quantidade de criadores"
            error={error('quantidade_criadores')}
            hint="Peso 30% do score"
          >
            <input
              name="quantidade_criadores"
              type="number"
              step="1"
              min="0"
              defaultValue={product?.quantidade_criadores ?? 0}
              onChange={(event) =>
                setMetrics((prev) => ({
                  ...prev,
                  quantidade_criadores: Number(event.target.value) || 0,
                }))
              }
              className="field tabular-nums"
            />
          </Field>

          <Field
            label="MAX SCORE (0-100)"
            error={error('max_score')}
            hint="Deixe vazio para calcular automaticamente"
          >
            <input
              name="max_score"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={manualScore}
              onChange={(event) => setManualScore(event.target.value)}
              placeholder="automático"
              className="field tabular-nums"
            />
          </Field>
        </div>

        <div
          className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${band.className}`}
        >
          <p className="flex items-center gap-2 text-xs font-bold tracking-wider uppercase">
            <Sparkles className="size-4" />
            Prévia do MAX SCORE
          </p>
          <p className="flex items-baseline gap-2">
            <span className="text-2xl font-black tabular-nums">
              {previewScore.toFixed(2)}
            </span>
            <span className="text-xs opacity-70">/100 · {band.label}</span>
          </p>
        </div>
      </div>

      <div className="panel space-y-5 p-5">
        <SectionTitle step="3" title="Publicação" hint="Status na plataforma e estratégia sugerida" />

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Status *" error={error('status')}>
            <select name="status" required defaultValue={product?.status ?? 'ativo'} className="field">
              {STATUS_LIST.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Estratégia sugerida"
            error={error('estrategia')}
            hint="Como o criador deve trabalhar esse produto"
            className="md:col-span-2"
          >
            <textarea
              name="estrategia"
              rows={4}
              defaultValue={product?.estrategia ?? ''}
              className="field resize-y"
            />
          </Field>
        </div>
      </div>

      {result && !result.ok ? (
        <p className="rounded-xl border border-brand-pink/40 bg-brand-pink/10 px-4 py-3 text-sm text-brand-pink">
          {result.error}
        </p>
      ) : null}

      {result?.ok ? (
        <p className="rounded-xl border border-brand-lime/40 bg-brand-lime/10 px-4 py-3 text-sm text-brand-lime">
          {result.message ?? 'Salvo com sucesso.'}
        </p>
      ) : null}

      {savedId ? (
        <p className="text-xs text-slate-500">
          Formulário limpo — você pode cadastrar o próximo produto.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {product ? 'Salvar alterações' : 'Cadastrar produto'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin')}
          className="btn-secondary"
          disabled={isPending}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function SectionTitle({
  step,
  title,
  hint,
}: {
  step: string;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-white/8 pb-4">
      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-cyan/15 text-xs font-black text-brand-cyan">
        {step}
      </span>
      <div>
        <h2 className="text-sm font-bold text-white">{title}</h2>
        {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  children,
  className = '',
}: {
  label: string;
  hint?: string;
  error?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-slate-500">{hint}</span> : null}
      {error}
    </label>
  );
}

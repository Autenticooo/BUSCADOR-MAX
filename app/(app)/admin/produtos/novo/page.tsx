import { ArrowLeft, Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { PageHeader } from '@/components/page-header';
import { ProductForm } from '@/components/product-form';
import { requireAdmin } from '@/lib/session';

export const metadata: Metadata = { title: 'Adicionar produto' };
export const dynamic = 'force-dynamic';

export default async function NovoProdutoPage() {
  await requireAdmin();

  return (
    <>
      <Link href="/admin" className="btn-ghost mb-4 -ml-2 px-2 text-sm">
        <ArrowLeft className="size-4" />
        Voltar para o painel
      </Link>

      <PageHeader
        title="Adicionar produto"
        description="Cadastro manual na base de produtos TikTok Shop. Campos com * são obrigatórios."
        actions={
          <span className="chip border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan">
            <Plus className="size-3" />
            Novo cadastro
          </span>
        }
      />

      <ProductForm />
    </>
  );
}

import { ArrowLeft, Pencil } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { DeleteProductButton } from '@/components/delete-product-button';
import { PageHeader } from '@/components/page-header';
import { ProductForm } from '@/components/product-form';
import { fetchProductById } from '@/lib/products';
import { requireAdmin } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Editar produto' };
export const dynamic = 'force-dynamic';

export default async function EditarProdutoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();

  const { id } = await params;
  const supabase = await createClient();
  const product = await fetchProductById(supabase, id);

  if (!product) notFound();

  return (
    <>
      <Link href="/admin" className="btn-ghost mb-4 -ml-2 px-2 text-sm">
        <ArrowLeft className="size-4" />
        Voltar para o painel
      </Link>

      <PageHeader
        title="Editar produto"
        description={product.nome}
        actions={
          <>
            <Link
              href={`/produtos/${product.id}`}
              className="btn-secondary"
            >
              Ver como assinante
            </Link>
            <DeleteProductButton
              productId={product.id}
              productName={product.nome}
              redirectTo="/admin"
            />
          </>
        }
      />

      <div className="mb-6 flex items-center gap-2 text-xs text-slate-500">
        <Pencil className="size-3.5" />
        ID {product.id}
      </div>

      <ProductForm product={product} />
    </>
  );
}

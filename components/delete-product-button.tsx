'use client';

import { Loader2, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { deleteProductAction } from '@/app/actions/products';

export function DeleteProductButton({
  productId,
  productName,
  redirectTo = '/admin',
}: {
  productId: string;
  productName: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    const confirmed = window.confirm(
      `Excluir o produto "${productName}"?\n\nEssa ação também remove o produto dos favoritos de todos os usuários.`,
    );
    if (!confirmed) return;

    setError(null);
    startTransition(async () => {
      const result = await deleteProductAction(productId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(redirectTo);
      router.refresh();
    });
  }

  return (
    <div className="space-y-1">
      <button type="button" onClick={handleDelete} disabled={isPending} className="btn-danger">
        {isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        Excluir
      </button>
      {error ? <p className="text-xs text-brand-pink">{error}</p> : null}
    </div>
  );
}

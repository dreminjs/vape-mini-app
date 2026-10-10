import { useSuspenseQuery } from '@tanstack/react-query';
import { MAX_VARIANTS_PER_PRODUCT, type AdminProductDto } from '@vapehard/shared';
import { Archive, Pencil, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';

import { prefetch } from '../../shared/lib/query-client';
import { Button } from '../../shared/ui/button';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog';
import { Money } from '../../shared/ui/money';
import { ProductImage } from '../../shared/ui/product-image';
import { EmptyState } from '../../shared/ui/states';

import { adminProductsQuery, useArchiveProduct, useChangeStock, useReplaceVariants } from './api';

export async function loader() {
  await prefetch(adminProductsQuery());
  return null;
}

function StockInput({
  productId,
  variantId,
  stock,
  name,
}: {
  productId: number;
  variantId: number;
  stock: number;
  name: string;
}) {
  const change = useChangeStock();
  const [draft, setDraft] = useState<string | null>(null);

  const commit = (next: number) => {
    setDraft(null);
    if (!Number.isInteger(next) || next < 0 || next === stock) return;
    const previous = stock;
    change.mutate(
      { productId, variantId, stock: next },
      {
        onSuccess: () => {
          toast.success(`Остаток «${name}»: ${String(next)}`, {
            action: {
              label: 'Отменить',
              onClick: () => {
                change.mutate({ productId, variantId, stock: previous });
              },
            },
          });
        },
      },
    );
  };

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label={`Уменьшить остаток ${name}`}
        disabled={stock <= 0}
        onClick={() => {
          commit(stock - 1);
        }}
        className="flex size-11 items-center justify-center rounded-lg bg-slate-800 font-bold text-slate-200 disabled:opacity-40"
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        aria-label={`Остаток ${name}`}
        value={draft ?? String(stock)}
        onChange={(e) => {
          setDraft(e.target.value);
        }}
        onBlur={() => {
          if (draft !== null) commit(Number(draft));
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        className="h-11 w-14 rounded-lg border border-slate-700 bg-slate-950 text-center text-sm font-bold text-white focus:border-vape-accent focus:outline-none"
      />
      <button
        type="button"
        aria-label={`Увеличить остаток ${name}`}
        onClick={() => {
          commit(stock + 1);
        }}
        className="flex size-11 items-center justify-center rounded-lg bg-slate-800 font-bold text-slate-200"
      >
        +
      </button>
    </div>
  );
}

function ProductStockCard({ product }: { product: AdminProductDto }) {
  const replace = useReplaceVariants();
  const archive = useArchiveProduct();
  const [newName, setNewName] = useState('');
  const [newStock, setNewStock] = useState('10');
  const [toDelete, setToDelete] = useState<number | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const current = product.variants.map((v) => ({ id: v.id, name: v.name, stock: v.stock }));
  const deleting = product.variants.find((v) => v.id === toDelete);

  const addVariant = () => {
    const name = newName.trim();
    if (!name) return toast.error('Введите название вкуса');
    if (current.some((v) => v.name.toLowerCase() === name.toLowerCase()))
      return toast.error('Такой вкус уже есть у товара');
    if (current.length >= MAX_VARIANTS_PER_PRODUCT)
      return toast.error(`Максимум ${String(MAX_VARIANTS_PER_PRODUCT)} вкусов на товар`);
    replace.mutate(
      {
        productId: product.id,
        variants: [...current, { name, stock: Math.max(0, Number(newStock) || 0) }],
      },
      {
        onSuccess: () => {
          setNewName('');
          toast.success('Вкус добавлен');
        },
      },
    );
  };

  return (
    <li className="space-y-2 rounded-2xl border border-slate-800 bg-vape-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <ProductImage src={product.imageUrl} alt="" className="size-11 shrink-0" />
          <div>
            <h3 className="text-sm leading-tight font-bold text-white">{product.name}</h3>
            <Money minor={product.priceMinor} className="text-xs font-semibold text-vape-glow" />
          </div>
        </div>
        <div className="flex">
          <Link
            to={`/admin/products/${String(product.id)}`}
            aria-label={`Редактировать ${product.name}`}
            className="flex size-11 items-center justify-center text-slate-300 hover:text-white"
          >
            <Pencil className="size-4" aria-hidden />
          </Link>
          <button
            type="button"
            aria-label={`Архивировать ${product.name}`}
            onClick={() => {
              setConfirmArchive(true);
            }}
            className="flex size-11 items-center justify-center text-red-400 hover:text-red-300"
          >
            <Archive className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      <ul className="space-y-1.5 border-t border-slate-800 pt-2">
        {product.variants.map((v) => (
          <li
            key={v.id}
            className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900 py-1 pr-1 pl-1"
          >
            <div className="flex min-w-0 items-center">
              <button
                type="button"
                aria-label={`Удалить вкус ${v.name}`}
                disabled={product.variants.length <= 1}
                onClick={() => {
                  setToDelete(v.id);
                }}
                className="flex size-11 shrink-0 items-center justify-center text-slate-500 hover:text-red-400 disabled:opacity-30"
              >
                <X className="size-4" aria-hidden />
              </button>
              <span className="truncate text-sm text-slate-300">{v.name}</span>
            </div>
            <StockInput productId={product.id} variantId={v.id} stock={v.stock} name={v.name} />
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-1.5">
        <input
          value={newName}
          onChange={(e) => {
            setNewName(e.target.value);
          }}
          placeholder="+ Новый вкус"
          aria-label="Название нового вкуса"
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-800 bg-slate-950 px-3 text-sm text-white focus:border-vape-accent focus:outline-none"
        />
        <input
          value={newStock}
          onChange={(e) => {
            setNewStock(e.target.value);
          }}
          type="number"
          min={0}
          aria-label="Количество"
          className="min-h-11 w-16 rounded-xl border border-slate-800 bg-slate-950 text-center text-sm font-bold text-white focus:border-vape-accent focus:outline-none"
        />
        <Button
          aria-label="Добавить вкус"
          pending={replace.isPending}
          onClick={addVariant}
          className="px-3"
          icon={<Plus className="size-4" aria-hidden />}
        />
      </div>

      <ConfirmDialog
        open={deleting !== undefined}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
        title={`Удалить вкус «${deleting?.name ?? ''}»?`}
        description="Остаток этого варианта будет удалён. История заказов сохранится."
        confirmText="Удалить"
        pending={replace.isPending}
        onConfirm={() => {
          replace.mutate(
            { productId: product.id, variants: current.filter((v) => v.id !== toDelete) },
            {
              onSuccess: () => {
                setToDelete(null);
                toast.info('Вкус удалён');
              },
            },
          );
        }}
      />
      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title={`Архивировать «${product.name}»?`}
        description="Товар исчезнет из каталога. Заказы с ним останутся в истории."
        confirmText="В архив"
        pending={archive.isPending}
        onConfirm={() => {
          archive.mutate(product.id, {
            onSuccess: () => {
              setConfirmArchive(false);
              toast.info('Товар перенесён в архив');
            },
          });
        }}
      />
    </li>
  );
}

export function Component() {
  const { data: products } = useSuspenseQuery(adminProductsQuery());
  if (products.length === 0) {
    return (
      <EmptyState
        icon={Plus}
        title="Товаров пока нет"
        action={
          <Link
            to="/admin/products/new"
            className="inline-flex min-h-11 items-center rounded-xl bg-vape-accent px-4 text-sm font-bold text-white"
          >
            Добавить товар
          </Link>
        }
      />
    );
  }
  return (
    <ul className="space-y-3">
      {products.map((p) => (
        <ProductStockCard key={p.id} product={p} />
      ))}
    </ul>
  );
}

import { useSuspenseQuery } from '@tanstack/react-query';
import { LOW_STOCK_THRESHOLD, type ProductDto, type VariantDto } from '@vapehard/shared';
import { Check, ShoppingCart } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams, type LoaderFunctionArgs } from 'react-router';
import { toast } from 'sonner';

import { NotFoundError } from '../../shared/lib/api';
import { prefetch } from '../../shared/lib/query-client';
import { haptic } from '../../shared/lib/telegram';
import { Button } from '../../shared/ui/button';
import { Money } from '../../shared/ui/money';
import { ProductImage } from '../../shared/ui/product-image';
import { Stepper } from '../../shared/ui/stepper';
import { useCartStore } from '../cart/store';
import { productQuery } from '../catalog/api';

const s = {
  fallbackDescription:
    'Оригинальная продукция от производителя. Все товары прошли контроль качества.',
  description: 'Описание',
  chooseTitle: 'Выберите вкусы и количество',
  chooseHint: 'Можно несколько',
  sale: '🔥 Акция / Уценка',
  selected: (n: number) => `Выбрано: ${String(n)} шт.`,
  addToCart: 'Добавить в корзину',
  added: (n: number) => `Добавлено позиций: ${String(n)} шт.`,
  stock: (v: VariantDto) =>
    v.stock <= 0
      ? 'Нет в наличии'
      : v.stock <= LOW_STOCK_THRESHOLD
        ? `Осталось ${String(v.stock)}`
        : `В наличии: ${String(v.stock)} шт.`,
};

function parseId(params: LoaderFunctionArgs['params']): number {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) throw new NotFoundError();
  return id;
}

export async function loader({ params }: LoaderFunctionArgs) {
  await prefetch(productQuery(parseId(params)));
  return null;
}

function VariantRow({
  variant,
  qty,
  onChange,
}: {
  variant: VariantDto;
  qty: number;
  onChange: (qty: number) => void;
}) {
  const disabled = variant.stock <= 0;
  const selected = qty > 0;
  const id = `variant-${String(variant.id)}`;
  return (
    <li
      className={`flex items-center justify-between gap-2 rounded-xl border p-2 transition ${
        selected
          ? 'border-vape-accent bg-vape-accent/15'
          : disabled
            ? 'border-slate-900 bg-slate-950/50 opacity-60'
            : 'border-slate-800 bg-slate-900'
      }`}
    >
      <label
        htmlFor={id}
        className={`flex min-h-11 flex-1 items-center gap-3 ${disabled ? '' : 'cursor-pointer'}`}
      >
        <input
          id={id}
          type="checkbox"
          className="peer sr-only"
          checked={selected}
          disabled={disabled}
          onChange={() => {
            onChange(selected ? 0 : 1);
          }}
        />
        <span
          aria-hidden
          className={`flex size-5 shrink-0 items-center justify-center rounded-md border peer-focus-visible:ring-2 peer-focus-visible:ring-vape-glow ${
            selected ? 'border-vape-accent bg-vape-accent text-white' : 'border-slate-600'
          }`}
        >
          {selected && <Check className="size-3.5" />}
        </span>
        <span>
          <span className="block text-sm font-medium text-slate-100">{variant.name}</span>
          <span
            className={`block text-xs ${variant.stock > 0 ? 'text-vape-green' : 'text-red-400'}`}
          >
            {s.stock(variant)}
          </span>
        </span>
      </label>
      {selected && (
        <Stepper
          value={qty}
          min={0}
          max={variant.stock}
          onChange={onChange}
          label={`Количество: ${variant.name}`}
        />
      )}
    </li>
  );
}

function ProductView({ product }: { product: ProductDto }) {
  const navigate = useNavigate();
  const add = useCartStore((st) => st.add);
  const [selection, setSelection] = useState<Record<number, number>>({});

  const selectedCount = Object.values(selection).reduce((sum, q) => sum + q, 0);

  const addToCart = () => {
    const inputs = product.variants
      .filter((v) => (selection[v.id] ?? 0) > 0)
      .map((v) => ({
        productId: product.id,
        variantId: v.id,
        productName: product.name,
        variantName: v.name,
        unitPriceMinor: product.priceMinor,
        imageUrl: product.imageUrl,
        qty: selection[v.id] ?? 0,
        maxStock: v.stock,
      }));
    add(inputs);
    haptic.light();
    toast.success(s.added(selectedCount));
    void navigate(-1);
  };

  return (
    <div className="space-y-4 pb-24">
      <div className="relative">
        <ProductImage
          src={product.imageUrl}
          alt={product.name}
          className="rounded-2xl border border-slate-800"
        />
        {product.oldPriceMinor !== null && (
          <span className="absolute top-3 left-3 rounded-lg bg-vape-red px-2 py-1 text-xs font-bold text-white shadow-lg">
            {s.sale}
          </span>
        )}
      </div>

      <section className="space-y-2 rounded-2xl border border-slate-800 bg-vape-card p-4">
        <span className="rounded-md bg-vape-accent/20 px-2 py-0.5 text-xs font-bold text-vape-glow">
          {product.categoryTitle}
        </span>
        <h1 className="text-lg leading-snug font-bold text-white">{product.name}</h1>
        <div className="flex items-baseline gap-2">
          <Money minor={product.priceMinor} className="text-xl font-black text-vape-glow" />
          {product.oldPriceMinor !== null && (
            <Money minor={product.oldPriceMinor} className="text-sm text-slate-500 line-through" />
          )}
        </div>
      </section>

      <section className="space-y-1 rounded-2xl border border-slate-800 bg-vape-card p-4">
        <h2 className="text-xs font-bold tracking-wider text-slate-300 uppercase">
          {s.description}
        </h2>
        <p className="text-sm leading-relaxed text-vape-muted">
          {product.description || s.fallbackDescription}
        </p>
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-800 bg-vape-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-200">{s.chooseTitle}</h2>
          <span className="text-xs text-vape-muted">{s.chooseHint}</span>
        </div>
        <ul className="space-y-2">
          {product.variants.map((v) => (
            <VariantRow
              key={v.id}
              variant={v}
              qty={selection[v.id] ?? 0}
              onChange={(qty) => {
                setSelection((prev) => ({ ...prev, [v.id]: Math.max(0, Math.min(qty, v.stock)) }));
              }}
            />
          ))}
        </ul>
      </section>

      {/* Sticky CTA above the tab bar and the home indicator. */}
      <div className="fixed inset-x-0 bottom-[calc(var(--tabbar-height)+var(--safe-bottom))] z-30 mx-auto max-w-md px-4 pb-2">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-vape-card/95 p-3 shadow-2xl backdrop-blur-md">
          <div>
            <span className="block text-xs text-vape-muted">{s.selected(selectedCount)}</span>
            <Money
              minor={selectedCount * product.priceMinor}
              className="text-base font-extrabold text-vape-glow"
            />
          </div>
          <Button
            disabled={selectedCount === 0}
            onClick={addToCart}
            icon={<ShoppingCart className="size-4" aria-hidden />}
          >
            {s.addToCart}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Component() {
  const id = parseId(useParams());
  const { data } = useSuspenseQuery(productQuery(id));
  return <ProductView key={data.id} product={data} />;
}

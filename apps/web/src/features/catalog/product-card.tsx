import type { ProductListItemDto } from '@vapehard/shared';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';

import { plural } from '../../shared/lib/hooks';
import { Money } from '../../shared/ui/money';
import { ProductImage } from '../../shared/ui/product-image';

import { s } from './strings';

export function ProductCard({ product }: { product: ProductListItemDto }) {
  const inStock = product.totalStock > 0;
  return (
    <Link
      to={`/product/${String(product.id)}`}
      className="group relative flex flex-col justify-between rounded-2xl border border-slate-800 bg-vape-card p-2.5 shadow-lg transition hover:border-vape-accent"
    >
      {product.oldPriceMinor !== null && (
        <span className="absolute top-3.5 left-3.5 z-10 rounded-md bg-vape-red px-1.5 py-0.5 text-xs font-bold text-white shadow">
          {s.sale}
        </span>
      )}
      <div>
        <ProductImage
          src={product.imageUrl}
          alt={product.name}
          className={inStock ? '' : 'opacity-50'}
        />
        <h3 className="mt-2 line-clamp-2 text-sm leading-snug font-semibold text-slate-100 group-hover:text-vape-glow">
          {product.name}
        </h3>
        <p className="mt-1 text-xs text-vape-muted">
          {product.variantCount} {plural(product.variantCount, s.variantForms)}
        </p>
      </div>
      <div className="mt-3">
        <div className="mb-2 flex flex-wrap items-baseline gap-x-1.5">
          <Money minor={product.priceMinor} className="text-sm font-extrabold text-vape-glow" />
          {product.oldPriceMinor !== null && (
            <Money minor={product.oldPriceMinor} className="text-xs text-slate-500 line-through" />
          )}
        </div>
        <div
          className={`ui-chrome flex min-h-9 items-center justify-center gap-1 rounded-xl text-xs font-medium ${
            inStock
              ? 'bg-slate-800 text-slate-200 group-hover:bg-vape-accent group-hover:text-white'
              : 'bg-slate-900 text-slate-500'
          }`}
        >
          {inStock && <ArrowRight className="size-3" aria-hidden />}
          {inStock ? s.choose : s.outOfStock}
        </div>
      </div>
    </Link>
  );
}

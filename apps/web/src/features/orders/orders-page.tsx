import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { DELIVERY_OPTIONS, type OrderDto } from '@vapehard/shared';
import { ChevronRight, PackageOpen } from 'lucide-react';
import { Link } from 'react-router';

import { prefetchInfinite } from '../../shared/lib/query-client';
import { Button } from '../../shared/ui/button';
import { Money } from '../../shared/ui/money';
import { EmptyState } from '../../shared/ui/states';
import { StatusBadge } from '../../shared/ui/status-badge';

import { ordersInfiniteQuery } from './api';

export async function loader() {
  await prefetchInfinite(ordersInfiniteQuery());
  return null;
}

export const dateTime = new Intl.DateTimeFormat('ru-BY', {
  dateStyle: 'short',
  timeStyle: 'short',
});
export const deliveryTitle = (method: OrderDto['deliveryMethod']) =>
  DELIVERY_OPTIONS.find((d) => d.method === method)?.title ?? method;

function OrderCard({ order }: { order: OrderDto }) {
  return (
    <li>
      <Link
        to={`/orders/${String(order.id)}`}
        className="block space-y-2 rounded-2xl border border-slate-800 bg-vape-card p-3 transition hover:border-vape-accent"
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div>
            <span className="text-sm font-bold text-white">{order.displayNumber}</span>
            <span className="block text-xs text-vape-muted">
              {dateTime.format(new Date(order.createdAt))}
            </span>
          </div>
          <StatusBadge status={order.status} />
        </div>
        <ul className="space-y-1 text-sm text-slate-300">
          {order.items.map((it, i) => (
            <li key={i} className="flex justify-between gap-2">
              <span className="truncate">
                {it.productName} ({it.variantName}) ×{it.qty}
              </span>
              <Money minor={it.lineTotalMinor} className="shrink-0 font-semibold" />
            </li>
          ))}
        </ul>
        {order.giftName && <p className="text-xs text-vape-green">🎁 Подарок: {order.giftName}</p>}
        <div className="flex items-center justify-between border-t border-slate-800 pt-2 text-sm">
          <span className="text-xs text-vape-muted">{deliveryTitle(order.deliveryMethod)}</span>
          <span className="flex items-center gap-1 font-bold text-vape-glow">
            Итого: <Money minor={order.totalMinor} />
            <ChevronRight className="size-4 text-vape-muted" aria-hidden />
          </span>
        </div>
      </Link>
    </li>
  );
}

export function Component() {
  const { data, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useSuspenseInfiniteQuery(ordersInfiniteQuery());
  const orders = data.pages.flatMap((p) => p.items);

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={PackageOpen}
        title="У вас пока нет заказов"
        text="Сделайте первый заказ из каталога"
        action={
          <Link
            to="/"
            className="inline-flex min-h-11 items-center rounded-xl bg-vape-accent px-4 text-sm font-bold text-white"
          >
            Перейти в каталог
          </Link>
        }
      />
    );
  }
  return (
    <div className="space-y-3">
      <h1 className="text-base font-bold text-white">Мои заказы</h1>
      <ul className="space-y-3">
        {orders.map((o) => (
          <OrderCard key={o.id} order={o} />
        ))}
      </ul>
      {hasNextPage && (
        <Button
          variant="secondary"
          block
          pending={isFetchingNextPage}
          onClick={() => void fetchNextPage()}
        >
          Показать ещё
        </Button>
      )}
    </div>
  );
}

import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import {
  nextStatuses,
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  type AdminOrderDto,
  type OrderStatus,
} from '@vapehard/shared';
import { Inbox, Search } from 'lucide-react';
import { Suspense, useState } from 'react';
import { toast } from 'sonner';

import { useDebouncedValue } from '../../shared/lib/hooks';
import { Button } from '../../shared/ui/button';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog';
import { Money } from '../../shared/ui/money';
import { ListSkeleton } from '../../shared/ui/skeleton';
import { EmptyState } from '../../shared/ui/states';
import { StatusBadge } from '../../shared/ui/status-badge';
import { deliveryTitle } from '../orders/orders-page';

import { adminOrdersQuery, useChangeOrderStatus } from './api';

function OrderRow({ order }: { order: AdminOrderDto }) {
  const change = useChangeOrderStatus();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const options = nextStatuses(order.status);

  const apply = (status: OrderStatus) => {
    change.mutate(
      { id: order.id, status },
      { onSuccess: () => toast.success(`${order.displayNumber}: ${ORDER_STATUS_LABELS[status]}`) },
    );
  };

  return (
    <li className="space-y-2 rounded-2xl border border-slate-800 bg-vape-card p-3">
      <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2">
        <div>
          <span className="text-sm font-bold text-white select-text">{order.displayNumber}</span>
          <a
            href={`https://t.me/${order.contactUsername}`}
            className="block text-xs font-medium text-vape-glow select-text"
            target="_blank"
            rel="noreferrer"
          >
            @{order.contactUsername}
          </a>
        </div>
        <StatusBadge status={order.status} />
      </div>
      <ul className="space-y-1 text-sm text-slate-300">
        {order.items.map((it, i) => (
          <li key={i} className="flex justify-between gap-2">
            <span>
              {it.productName} ({it.variantName}) ×{it.qty}
            </span>
            <Money minor={it.lineTotalMinor} className="shrink-0 font-semibold" />
          </li>
        ))}
      </ul>
      {order.giftName && <p className="text-xs text-vape-green">🎁 {order.giftName}</p>}
      <div className="flex items-center justify-between border-t border-slate-800 pt-2 text-sm">
        <span className="text-xs text-vape-muted">{deliveryTitle(order.deliveryMethod)}</span>
        <Money minor={order.totalMinor} className="font-bold text-white" />
      </div>
      {options.length > 0 && (
        <div className="flex gap-2">
          <label htmlFor={`status-${String(order.id)}`} className="sr-only">
            Сменить статус
          </label>
          <select
            id={`status-${String(order.id)}`}
            value=""
            disabled={change.isPending}
            onChange={(e) => {
              const status = e.target.value as OrderStatus;
              if (status === 'CANCELLED') setConfirmCancel(true);
              else apply(status);
            }}
            className="min-h-11 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm font-bold text-white"
          >
            <option value="">Сменить статус…</option>
            {options.map((s) => (
              <option key={s} value={s}>
                {ORDER_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      )}
      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={`Отменить заказ ${order.displayNumber}?`}
        description="Товары вернутся на склад, промокод снова станет доступен клиенту."
        confirmText="Отменить заказ"
        onConfirm={() => {
          setConfirmCancel(false);
          apply('CANCELLED');
        }}
      />
    </li>
  );
}

function OrdersList({ status, q }: { status: OrderStatus | undefined; q: string }) {
  const { data, hasNextPage, fetchNextPage, isFetchingNextPage } = useSuspenseInfiniteQuery(
    adminOrdersQuery(status, q),
  );
  const orders = data.pages.flatMap((p) => p.items);
  if (orders.length === 0) return <EmptyState icon={Inbox} title="Заказов не найдено" />;
  return (
    <>
      <ul className="space-y-3">
        {orders.map((o) => (
          <OrderRow key={o.id} order={o} />
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
    </>
  );
}

export function Component() {
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [input, setInput] = useState('');
  const q = useDebouncedValue(input.trim(), 300);
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-vape-muted"
            aria-hidden
          />
          <input
            type="search"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
            }}
            placeholder="VH-1001 или username"
            aria-label="Поиск заказа"
            className="min-h-11 w-full rounded-xl border border-slate-800 bg-vape-card pr-3 pl-9 text-sm text-white focus:border-vape-accent focus:outline-none"
          />
        </div>
        <label htmlFor="status-filter" className="sr-only">
          Статус
        </label>
        <select
          id="status-filter"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as OrderStatus | '');
          }}
          className="min-h-11 rounded-xl border border-slate-800 bg-vape-card px-2 text-sm text-white"
        >
          <option value="">Все</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      <Suspense fallback={<ListSkeleton />}>
        <OrdersList status={status || undefined} q={q} />
      </Suspense>
    </div>
  );
}

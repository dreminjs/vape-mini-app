import { useSuspenseQuery } from '@tanstack/react-query';
import type { OrderStatus } from '@vapehard/shared';
import { ORDER_STATUS_LABELS } from '@vapehard/shared';
import { useParams, type LoaderFunctionArgs } from 'react-router';

import { NotFoundError } from '../../shared/lib/api';
import { prefetch } from '../../shared/lib/query-client';
import { Money, PriceSummary } from '../../shared/ui/money';
import { StatusBadge } from '../../shared/ui/status-badge';

import { orderQuery } from './api';
import { dateTime, deliveryTitle } from './orders-page';

function parseId(params: LoaderFunctionArgs['params']): number {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) throw new NotFoundError();
  return id;
}

export async function loader({ params }: LoaderFunctionArgs) {
  await prefetch(orderQuery(parseId(params)));
  return null;
}

const FLOW: OrderStatus[] = ['PROCESSING', 'HANDED_TO_COURIER', 'COMPLETED'];

function Timeline({ status }: { status: OrderStatus }) {
  const steps: OrderStatus[] = status === 'CANCELLED' ? ['PROCESSING', 'CANCELLED'] : FLOW;
  const current = steps.indexOf(status);
  return (
    <ol className="space-y-3" aria-label="Статус заказа">
      {steps.map((step, i) => {
        const done = i <= current;
        const color =
          step === 'CANCELLED' ? 'bg-vape-red' : done ? 'bg-vape-green' : 'bg-slate-700';
        return (
          <li
            key={step}
            className="flex items-center gap-3"
            aria-current={i === current ? 'step' : undefined}
          >
            <span className={`size-3 rounded-full ${color}`} aria-hidden />
            <span className={done ? 'text-sm text-white' : 'text-sm text-slate-500'}>
              {ORDER_STATUS_LABELS[step]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function Component() {
  const { data: order } = useSuspenseQuery(orderQuery(parseId(useParams())));
  const itemsCount = order.items.reduce((sum, i) => sum + i.qty, 0);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white select-text">{order.displayNumber}</h1>
          <p className="text-xs text-vape-muted">{dateTime.format(new Date(order.createdAt))}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <section className="rounded-2xl border border-slate-800 bg-vape-card p-4">
        <h2 className="mb-3 text-sm font-bold text-slate-200">Статус</h2>
        <Timeline status={order.status} />
      </section>

      <section className="space-y-2 rounded-2xl border border-slate-800 bg-vape-card p-4">
        <h2 className="text-sm font-bold text-slate-200">Товары</h2>
        <ul className="space-y-1.5 text-sm text-slate-300">
          {order.items.map((it, i) => (
            <li key={i} className="flex justify-between gap-2">
              <span>
                {it.productName} ({it.variantName}) ×{it.qty}
              </span>
              <Money minor={it.lineTotalMinor} className="shrink-0" />
            </li>
          ))}
        </ul>
        <p className="pt-2 text-xs text-vape-muted">
          Доставка: {deliveryTitle(order.deliveryMethod)}
        </p>
        {order.rewardCode && (
          <p className="text-xs text-vape-muted">
            Промокод: <span className="select-text text-vape-glow">{order.rewardCode}</span>
          </p>
        )}
      </section>

      <PriceSummary
        itemsCount={itemsCount}
        subtotalMinor={order.subtotalMinor}
        discountMinor={order.discountMinor}
        deliveryCostMinor={order.deliveryCostMinor}
        totalMinor={order.totalMinor}
        giftName={order.giftName}
      />
    </div>
  );
}

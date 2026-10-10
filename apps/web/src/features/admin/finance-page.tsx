import { useQuery } from '@tanstack/react-query';
import { ORDER_STATUS_LABELS, ORDER_STATUSES } from '@vapehard/shared';
import { useState } from 'react';

import { Money } from '../../shared/ui/money';
import { Skeleton } from '../../shared/ui/skeleton';
import { ErrorState } from '../../shared/ui/states';

import { analyticsQuery } from './api';

/** <input type="date"> value → ISO range bound (local day start / end). */
function toIso(date: string, endOfDay: boolean): string | undefined {
  if (!date) return undefined;
  const d = new Date(`${date}T${endOfDay ? '23:59:59.999' : '00:00:00'}`);
  return d.toISOString();
}

export function Component() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const query = useQuery(analyticsQuery(toIso(from, false), toIso(to, true)));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <label className="text-sm text-slate-300">
          С
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
            }}
            className="mt-1 min-h-11 w-full rounded-xl border border-slate-800 bg-vape-card px-2 text-white"
          />
        </label>
        <label className="text-sm text-slate-300">
          По
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
            }}
            className="mt-1 min-h-11 w-full rounded-xl border border-slate-800 bg-vape-card px-2 text-white"
          />
        </label>
      </div>

      {query.isPending && <Skeleton className="h-48 w-full rounded-2xl" />}
      {query.isError && (
        <ErrorState
          message="Не удалось загрузить статистику"
          onRetry={() => void query.refetch()}
        />
      )}
      {query.data && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-slate-800 bg-vape-card p-3 text-center">
              <span className="block text-xs text-vape-muted">Выручка (завершённые)</span>
              <Money
                minor={query.data.revenueMinor}
                className="text-lg font-black text-vape-green"
              />
            </div>
            <div className="rounded-2xl border border-slate-800 bg-vape-card p-3 text-center">
              <span className="block text-xs text-vape-muted">Остаток на складе</span>
              <span className="text-lg font-black text-vape-glow">{query.data.totalStock} шт</span>
            </div>
          </div>
          <section className="space-y-2 rounded-2xl border border-slate-800 bg-vape-card p-3">
            <h2 className="text-sm font-bold text-white">
              Заказы по статусам · всего {query.data.ordersCount}
            </h2>
            <ul className="space-y-2">
              {ORDER_STATUSES.map((s) => {
                const count = query.data.countsByStatus[s];
                const share = query.data.ordersCount ? (count / query.data.ordersCount) * 100 : 0;
                return (
                  <li key={s} className="text-sm">
                    <div className="flex justify-between text-slate-300">
                      <span>{ORDER_STATUS_LABELS[s]}</span>
                      <span className="font-bold">{count}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded bg-slate-800" aria-hidden>
                      <div
                        className="h-full bg-vape-accent"
                        style={{ width: `${String(share)}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

import { useSuspenseQuery } from '@tanstack/react-query';

import { prefetch } from '../../shared/lib/query-client';

import { prizesQuery } from './api';

export async function loader() {
  await prefetch(prizesQuery());
  return null;
}

const percent = new Intl.NumberFormat('ru-BY', { style: 'percent', maximumFractionDigits: 4 });

function oneIn(probability: number): string {
  if (probability <= 0) return '—';
  return `1 к ${Math.round(1 / probability).toLocaleString('ru-BY')}`;
}

/** Read-only. Customers never see these numbers (the API hides weights). */
export function Component() {
  const { data: prizes } = useSuspenseQuery(prizesQuery());
  return (
    <section className="space-y-3 rounded-2xl border border-slate-800 bg-vape-card p-3">
      <div>
        <h2 className="text-sm font-bold text-white">Математическая вероятность призов</h2>
        <p className="text-xs text-vape-muted">
          Видно только администратору. Клиенты шансы не видят.
        </p>
      </div>
      <ul className="space-y-1.5">
        {prizes.map((p) => (
          <li
            key={p.key}
            className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 p-2.5 text-sm"
          >
            <span className="flex items-center gap-2">
              <span
                className="size-3 rounded-full"
                style={{ backgroundColor: p.color }}
                aria-hidden
              />
              <span className="text-slate-200">{p.title}</span>
              {!p.isActive && <span className="text-xs text-red-400">выкл.</span>}
            </span>
            <span className="text-right">
              <span className="block font-bold text-vape-glow">
                {percent.format(p.probability)}
              </span>
              <span className="text-xs text-vape-muted">
                {oneIn(p.probability)} · вес {p.weight}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

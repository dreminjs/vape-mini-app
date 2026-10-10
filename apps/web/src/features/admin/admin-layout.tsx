import { useSuspenseQuery } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { Navigate, NavLink, Outlet } from 'react-router';

import { meQuery } from '../session/api';

const TABS = [
  { to: '/admin/stock', label: 'Склад' },
  { to: '/admin/products/new', label: '+ Товар' },
  { to: '/admin/orders', label: 'Заказы' },
  { to: '/admin/finance', label: 'Финансы' },
  { to: '/admin/roulette', label: 'Шансы рулетки' },
];

/** UI guard only. Every admin API route is protected on the server too. */
export function Component() {
  const { data: me } = useSuspenseQuery(meQuery());
  if (!me.isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <h1 className="flex items-center gap-1.5 text-base font-bold text-amber-400">
          <ShieldCheck className="size-5" aria-hidden /> Панель управления
        </h1>
      </div>
      <nav
        aria-label="Разделы админки"
        className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4"
      >
        <div className="flex gap-1 rounded-xl border border-slate-800 bg-slate-900 p-1">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                `ui-chrome flex min-h-11 items-center rounded-lg px-3 text-sm font-medium whitespace-nowrap transition ${
                  isActive ? 'bg-vape-accent text-white' : 'text-slate-400 hover:text-white'
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
      <Outlet />
    </div>
  );
}

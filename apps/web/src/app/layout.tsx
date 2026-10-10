import { useSuspenseQuery } from '@tanstack/react-query';
import {
  ClipboardList,
  Disc3,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Store,
  User,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import { Suspense, useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';

import { selectCount, useCartStore } from '../features/cart/store';
import { meQuery } from '../features/session/api';
import { useOnline } from '../shared/lib/hooks';
import { bindNativeBackButton } from '../shared/lib/telegram';
import { ListSkeleton } from '../shared/ui/skeleton';

/** Tab roots hide the native back button; inner pages show it. */
const TAB_ROOTS = new Set([
  '/',
  '/cart',
  '/roulette',
  '/orders',
  '/profile',
  '/admin',
  '/age-gate',
]);

function useTelegramBackButton() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  useEffect(
    () =>
      bindNativeBackButton(!TAB_ROOTS.has(pathname), () => {
        void navigate(-1);
      }),
    [pathname, navigate],
  );
}

function Header({ isAdmin }: { isAdmin: boolean }) {
  return (
    <header className="ui-chrome sticky top-0 z-30 flex items-center justify-between border-b border-slate-800 bg-vape-card/95 px-4 pt-[var(--safe-top)] pb-2 backdrop-blur">
      <Link
        to="/"
        className="flex min-h-11 items-center gap-2"
        aria-label="VapeHard Minsk — на главную"
      >
        <span className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-tr from-vape-accent to-vape-glow text-lg font-bold text-white shadow-md">
          V
        </span>
        <span>
          <span className="block text-sm leading-none font-bold tracking-wide text-white">
            VapeHard Minsk
          </span>
          <span className="text-xs text-vape-muted">Telegram Store</span>
        </span>
      </Link>
      <Link
        to="/profile"
        className="flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs font-medium text-slate-200"
      >
        {isAdmin ? (
          <ShieldCheck className="size-4 text-vape-glow" aria-hidden />
        ) : (
          <User className="size-4" aria-hidden />
        )}
        {isAdmin ? 'Админ' : 'Профиль'}
      </Link>
    </header>
  );
}

function Tab({
  to,
  icon: Icon,
  label,
  badge,
  glow,
  end = false,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
  badge?: number;
  glow?: boolean;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `relative flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-medium transition ${
          isActive ? 'text-vape-glow' : 'text-slate-400 hover:text-slate-200'
        }`
      }
    >
      <span className="relative">
        <Icon
          className={`size-5 ${glow ? 'text-vape-glow drop-shadow-[0_0_6px_rgb(168_85_247)]' : ''}`}
          aria-hidden
        />
        {badge !== undefined && badge > 0 && (
          <span className="absolute -top-2 -right-3 min-w-5 rounded-full bg-vape-red px-1 text-center text-xs leading-5 font-extrabold text-white">
            <span className="sr-only">в корзине </span>
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </span>
      {label}
    </NavLink>
  );
}

function TabBar({ isAdmin }: { isAdmin: boolean }) {
  const count = useCartStore(selectCount);
  return (
    <nav
      aria-label="Основная навигация"
      className="ui-chrome fixed inset-x-0 bottom-0 z-40 mx-auto flex h-[calc(var(--tabbar-height)+var(--safe-bottom))] max-w-md items-start gap-1 border-t border-slate-800 bg-vape-card/95 px-2 pt-2 pb-[var(--safe-bottom)] backdrop-blur-md"
    >
      <Tab to="/" end icon={Store} label="Каталог" />
      <Tab to="/cart" icon={ShoppingCart} label="Корзина" badge={count} />
      <Tab to="/roulette" icon={Disc3} label="Рулетка" glow />
      <Tab to="/orders" icon={ClipboardList} label="Заказы" />
      <Tab to="/profile" icon={User} label="Профиль" />
      {isAdmin && <Tab to="/admin" icon={Settings} label="Админка" />}
    </nav>
  );
}

function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-amber-900 px-4 py-2 text-sm text-amber-100"
    >
      <WifiOff className="size-4" aria-hidden /> Нет подключения к интернету
    </div>
  );
}

export function AppLayout() {
  const { data: me } = useSuspenseQuery(meQuery());
  useTelegramBackButton();
  return (
    <div className="mx-auto flex min-h-[var(--app-height)] max-w-md flex-col bg-vape-dark">
      <Header isAdmin={me.isAdmin} />
      <OfflineBanner />
      <main className="flex-1 px-4 pt-3 pb-[calc(var(--tabbar-height)+var(--safe-bottom)+1rem)]">
        <Suspense fallback={<ListSkeleton />}>
          <Outlet />
        </Suspense>
      </main>
      <TabBar isAdmin={me.isAdmin} />
    </div>
  );
}

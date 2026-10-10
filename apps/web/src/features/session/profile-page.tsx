import { useSuspenseQuery } from '@tanstack/react-query';
import { KeyRound, LogOut, MessageCircle, ShieldCheck, User } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';

import { ApiError } from '../../shared/lib/api';
import { openTgLink } from '../../shared/lib/telegram';
import { Button } from '../../shared/ui/button';

import { meQuery, publicConfigQuery, useAdminLogin, useAdminLogout } from './api';

function AdminLoginForm() {
  const login = useAdminLogin();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (!password) return;
    setError(null);
    login.mutate(password, {
      onSuccess: () => {
        setPassword('');
        toast.success('Вход выполнен');
      },
      onError: (err) => {
        setPassword('');
        setError(
          err instanceof ApiError && err.code === 'RATE_LIMITED'
            ? 'Слишком много попыток. Попробуйте через 15 минут.'
            : 'Неверный пароль',
        );
      },
    });
  };

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-2xl border border-slate-800 bg-vape-card p-4"
    >
      <h2 className="flex items-center gap-2 text-sm font-bold text-white">
        <KeyRound className="size-4 text-vape-glow" aria-hidden /> Вход для администратора
      </h2>
      <label htmlFor="admin-password" className="sr-only">
        Пароль администратора
      </label>
      <input
        id="admin-password"
        type="password"
        autoComplete="current-password"
        placeholder="Пароль"
        value={password}
        onChange={(e) => {
          setPassword(e.target.value);
        }}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'admin-password-error' : undefined}
        className="min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-white focus:border-vape-accent focus:outline-none"
      />
      {error && (
        <p id="admin-password-error" role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}
      <Button type="submit" block pending={login.isPending} disabled={!password}>
        Войти
      </Button>
    </form>
  );
}

export function Component() {
  const { data: me } = useSuspenseQuery(meQuery());
  const { data: config } = useSuspenseQuery(publicConfigQuery());
  const logout = useAdminLogout();
  const fullName = [me.firstName, me.lastName].filter(Boolean).join(' ');

  return (
    <div className="space-y-4">
      <section className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-vape-card p-4">
        <div className="flex size-12 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-vape-muted">
          {me.isAdmin ? (
            <ShieldCheck className="size-6 text-vape-glow" aria-hidden />
          ) : (
            <User className="size-6" aria-hidden />
          )}
        </div>
        <div>
          <h1 className="text-base font-bold text-white">{fullName || 'Профиль'}</h1>
          {me.username && <p className="text-sm text-vape-glow">@{me.username}</p>}
          {me.isAdmin && <p className="text-xs text-amber-400">Администратор</p>}
        </div>
      </section>

      <section className="space-y-2 rounded-2xl border border-slate-800 bg-vape-card p-4 text-sm text-slate-300">
        <p>
          Заказы оформляются в приложении, а оплата и доставка согласуются с менеджером в Telegram.
        </p>
        <Button
          variant="secondary"
          block
          icon={<MessageCircle className="size-4" aria-hidden />}
          onClick={() => {
            openTgLink(`https://t.me/${config.managerUsername}`);
          }}
        >
          Написать менеджеру
        </Button>
      </section>

      {me.isAdmin ? (
        <section className="space-y-2 rounded-2xl border border-amber-400/30 bg-vape-card p-4">
          <Link
            to="/admin"
            className="flex min-h-11 items-center justify-center rounded-xl bg-gradient-to-r from-vape-accent to-vape-glow text-sm font-bold text-white"
          >
            Открыть панель управления
          </Link>
          {/* Permanent admins (ADMIN_TELEGRAM_IDS) have no password session to end. */}
          {me.role !== 'ADMIN' && (
            <Button
              variant="secondary"
              block
              pending={logout.isPending}
              icon={<LogOut className="size-4" aria-hidden />}
              onClick={() => {
                logout.mutate();
              }}
            >
              Выйти из админки
            </Button>
          )}
        </section>
      ) : (
        <AdminLoginForm />
      )}
    </div>
  );
}

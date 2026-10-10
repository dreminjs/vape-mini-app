import { useSuspenseQuery } from '@tanstack/react-query';
import { MessageCircle, ShieldCheck, User } from 'lucide-react';
import { Link } from 'react-router';

import { openTgLink } from '../../shared/lib/telegram';
import { Button } from '../../shared/ui/button';

import { meQuery, publicConfigQuery } from './api';

export function Component() {
  const { data: me } = useSuspenseQuery(meQuery());
  const { data: config } = useSuspenseQuery(publicConfigQuery());
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

      {me.isAdmin && (
        <Link
          to="/admin"
          className="flex min-h-11 items-center justify-center rounded-xl bg-gradient-to-r from-vape-accent to-vape-glow text-sm font-bold text-white"
        >
          Открыть панель управления
        </Link>
      )}
    </div>
  );
}

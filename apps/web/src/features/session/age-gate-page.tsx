import { useSuspenseQuery } from '@tanstack/react-query';
import { ShieldAlert } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router';

import { Button } from '../../shared/ui/button';

import { meQuery, useConfirmAge } from './api';

export function Component() {
  const { data: me } = useSuspenseQuery(meQuery());
  const confirm = useConfirmAge();
  const navigate = useNavigate();

  if (me.ageConfirmed) return <Navigate to="/" replace />;

  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-5 text-center">
      <div className="flex size-20 items-center justify-center rounded-full bg-vape-red/15 text-vape-red">
        <ShieldAlert className="size-10" aria-hidden />
      </div>
      <h1 className="text-2xl font-black text-white">Только для взрослых 18+</h1>
      <p className="max-w-xs text-sm text-slate-300">
        Магазин продаёт никотинсодержащую продукцию. Продолжая, вы подтверждаете, что вам
        исполнилось 18 лет.
      </p>
      <Button
        block
        className="max-w-xs"
        pending={confirm.isPending}
        onClick={() => {
          confirm.mutate(undefined, {
            onSuccess: () => {
              void navigate('/', { replace: true });
            },
          });
        }}
      >
        Мне есть 18 лет
      </Button>
      <p className="text-xs text-vape-muted">Если вам нет 18 — просто закройте приложение.</p>
    </div>
  );
}

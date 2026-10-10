import * as Dialog from '@radix-ui/react-dialog';
import { DELIVERY_OPTIONS, formatMoney, type OrderDto } from '@vapehard/shared';
import { CheckCircle2, Send } from 'lucide-react';

import { openTgLink } from '../../shared/lib/telegram';
import { Button } from '../../shared/ui/button';
import { Money } from '../../shared/ui/money';

interface Props {
  order: OrderDto | null;
  managerUsername: string;
  onClose: () => void;
}

export function OrderSuccessDialog({ order, managerUsername, onClose }: Props) {
  if (!order) return null;
  const text = `Здравствуйте! Оформил заказ #${order.displayNumber} на сумму ${formatMoney(order.totalMinor)}.`;
  const link = `https://t.me/${managerUsername}?text=${encodeURIComponent(text)}`;
  const delivery = DELIVERY_OPTIONS.find((d) => d.method === order.deliveryMethod)?.title;

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-vape-accent bg-vape-card p-5 text-center shadow-2xl">
          <div className="mx-auto mb-3 flex size-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
            <CheckCircle2 className="size-9" aria-hidden />
          </div>
          <Dialog.Title className="mb-1 text-xl font-bold text-white">
            Заказ <span className="select-text">#{order.displayNumber}</span> создан!
          </Dialog.Title>
          <Dialog.Description className="mb-4 text-sm text-slate-300">
            Для подтверждения и согласования времени доставки{' '}
            <b>обязательно напишите нашему менеджеру</b>!
          </Dialog.Description>
          <dl className="mb-4 space-y-1 rounded-xl border border-slate-800 bg-slate-900 p-3 text-left text-sm">
            <div className="flex justify-between">
              <dt className="text-vape-muted">Сумма заказа</dt>
              <dd className="font-bold text-white">
                <Money minor={order.totalMinor} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-vape-muted">Способ</dt>
              <dd className="text-white">{delivery}</dd>
            </div>
            {order.giftName && (
              <div className="flex justify-between">
                <dt className="text-vape-muted">Подарок</dt>
                <dd className="font-bold text-vape-green">🎁 {order.giftName}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-vape-muted">Ваш профиль</dt>
              <dd className="text-vape-glow">@{order.contactUsername}</dd>
            </div>
          </dl>
          <Button
            block
            className="mb-2"
            icon={<Send className="size-4" aria-hidden />}
            onClick={() => {
              openTgLink(link);
            }}
          >
            Написать @{managerUsername}
          </Button>
          <Dialog.Close asChild>
            <Button variant="ghost" block>
              Закрыть окно
            </Button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

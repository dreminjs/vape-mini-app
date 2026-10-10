import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { telegramUsernameSchema, type CartLine, type OrderDto } from '@vapehard/shared';
import { AlertTriangle, ShoppingBasket, Send, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';

import { ApiError } from '../../shared/lib/api';
import { useOnline } from '../../shared/lib/hooks';
import { prefetch } from '../../shared/lib/query-client';
import { haptic } from '../../shared/lib/telegram';
import { Button } from '../../shared/ui/button';
import { Money, PriceSummary } from '../../shared/ui/money';
import { ProductImage } from '../../shared/ui/product-image';
import { EmptyState } from '../../shared/ui/states';
import { Stepper } from '../../shared/ui/stepper';
import { meQuery, publicConfigQuery, useConfirmAge } from '../session/api';

import { cartValidateQuery, useCreateOrder } from './api';
import { OrderSuccessDialog } from './order-success-dialog';
import {
  selectBanners,
  selectDelivery,
  selectLines,
  selectRewardCode,
  useCartStore,
} from './store';

export async function loader() {
  await Promise.all([prefetch(publicConfigQuery()), prefetch(meQuery())]);
  return null;
}

const s = {
  title: 'Оформление заказа',
  positions: (n: number) => `${String(n)} поз.`,
  emptyTitle: 'Корзина пуста',
  emptyText: 'Добавьте позиции из каталога',
  toCatalog: 'Перейти в каталог',
  delivery: 'Доставка по Минску и РБ',
  username: 'Ваш Telegram username',
  usernameHint: 'В вашем Telegram нет username — укажите его, чтобы менеджер смог написать вам.',
  promo: 'Промокод / Бонус из Рулетки',
  apply: 'Применить',
  reset: 'Сбросить',
  promoActive: (code: string) => `Промокод ${code} активен`,
  checkout: 'Оформить и написать менеджеру',
  offline: 'Нет соединения — оформление недоступно',
  adult: 'Мне есть 18 лет',
  priceChanged: 'Цены на некоторые товары изменились. Проверьте сумму.',
  stockReduced: 'Некоторых товаров меньше, чем вы выбрали. Количество исправлено.',
  removed: 'Некоторые товары закончились и удалены из корзины.',
  remove: (name: string) => `Удалить ${name}`,
};

function CartLineRow({ line }: { line: CartLine }) {
  const setQty = useCartStore((st) => st.setQty);
  const remove = useCartStore((st) => st.remove);
  return (
    <li className="flex items-center gap-3 rounded-xl border border-slate-800 bg-vape-card p-2.5">
      <ProductImage src={line.imageUrl} alt="" className="size-14 shrink-0" />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-semibold text-white">{line.productName}</h3>
        <p className="truncate text-xs text-vape-glow">{line.variantName}</p>
        <Money
          minor={line.unitPriceMinor * line.qty}
          className="text-sm font-bold text-slate-200"
        />
      </div>
      <div className="flex flex-col items-end gap-1">
        <Stepper
          value={line.qty}
          min={1}
          max={line.maxStock}
          label={`Количество: ${line.productName}, ${line.variantName}`}
          onChange={(qty) => {
            setQty(line.variantId, qty);
          }}
        />
        <button
          type="button"
          className="flex min-h-11 items-center gap-1 px-2 text-xs text-slate-400 hover:text-vape-red"
          aria-label={s.remove(`${line.productName}, ${line.variantName}`)}
          onClick={() => {
            remove(line.variantId);
          }}
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>
    </li>
  );
}

function Banner({ children }: { children: string }) {
  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-xl border border-amber-800 bg-amber-950/60 p-3 text-sm text-amber-200"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      {children}
    </div>
  );
}

const usernameForm = z.object({ username: telegramUsernameSchema });

export function Component() {
  const lines = useCartStore(selectLines);
  const delivery = useCartStore(selectDelivery);
  const rewardCode = useCartStore(selectRewardCode);
  const banners = useCartStore(selectBanners);
  const { setDelivery, setRewardCode, clear } = useCartStore.getState();
  const { data: config } = useSuspenseQuery(publicConfigQuery());
  const { data: me } = useSuspenseQuery(meQuery());
  const online = useOnline();
  const createOrder = useCreateOrder();
  const confirmAge = useConfirmAge();
  const [adult, setAdult] = useState(false);

  const [promoInput, setPromoInput] = useState(rewardCode ?? '');
  const [successOrder, setSuccessOrder] = useState<OrderDto | null>(null);
  // One key per checkout attempt: retries of the same attempt never create a second order.
  const idempotencyKey = useRef(crypto.randomUUID());

  const validation = useQuery(cartValidateQuery(lines, delivery, rewardCode));

  const form = useForm<z.input<typeof usernameForm>, unknown, z.output<typeof usernameForm>>({
    resolver: zodResolver(usernameForm),
    defaultValues: { username: '' },
    shouldFocusError: true,
  });

  if (lines.length === 0 && !successOrder) {
    return (
      <EmptyState
        icon={ShoppingBasket}
        title={s.emptyTitle}
        text={s.emptyText}
        action={
          <Link
            to="/"
            className="inline-flex min-h-11 items-center rounded-xl bg-vape-accent px-4 text-sm font-bold text-white"
          >
            {s.toCatalog}
          </Link>
        }
      />
    );
  }

  const submit = async (contactUsername?: string) => {
    try {
      // The 18+ confirmation is stored on the server once, right before the first order.
      if (!me.ageConfirmed) await confirmAge.mutateAsync();
      const order = await createOrder.mutateAsync({
        input: {
          items: lines.map((l) => ({ variantId: l.variantId, qty: l.qty })),
          deliveryMethod: delivery,
          ...(contactUsername ? { contactUsername } : {}),
          ...(rewardCode ? { rewardCode } : {}),
        },
        idempotencyKey: idempotencyKey.current,
      });
      haptic.success();
      clear();
      setPromoInput('');
      idempotencyKey.current = crypto.randomUUID();
      setSuccessOrder(order);
    } catch (error) {
      haptic.error();
      if (
        error instanceof ApiError &&
        (error.code === 'OUT_OF_STOCK' || error.code === 'REWARD_INVALID')
      ) {
        // The cart changed on the server: a new attempt gets a new key.
        idempotencyKey.current = crypto.randomUUID();
        void validation.refetch();
      }
      toast.error(error instanceof ApiError ? error.message : 'Не удалось оформить заказ');
    }
  };

  const onCheckout = () => {
    if (me.username) void submit();
    else void form.handleSubmit((values) => submit(values.username))();
  };

  const totals = validation.data;
  const itemsCount = lines.reduce((sum, l) => sum + l.qty, 0);

  return (
    <div className="space-y-4">
      <h1 className="flex items-center justify-between text-base font-bold text-white">
        {s.title}
        <span className="text-sm font-normal text-vape-muted">{s.positions(lines.length)}</span>
      </h1>

      {banners.removed && <Banner>{s.removed}</Banner>}
      {banners.stockReduced && <Banner>{s.stockReduced}</Banner>}
      {banners.priceChanged && <Banner>{s.priceChanged}</Banner>}

      <ul className="space-y-2">
        {lines.map((l) => (
          <CartLineRow key={l.variantId} line={l} />
        ))}
      </ul>

      <fieldset className="space-y-2 rounded-xl border border-slate-800 bg-vape-card p-3">
        <legend className="px-1 text-sm font-bold text-slate-200">{s.delivery}</legend>
        {config.deliveryOptions.map((o) => (
          <label
            key={o.method}
            className={`flex min-h-11 cursor-pointer items-center justify-between rounded-xl border px-3 text-sm transition ${
              delivery === o.method
                ? 'border-vape-accent bg-vape-accent/10 text-white'
                : 'border-slate-800 bg-slate-900 text-slate-300'
            }`}
          >
            <span className="flex items-center gap-2">
              <input
                type="radio"
                name="delivery"
                className="accent-vape-accent"
                checked={delivery === o.method}
                onChange={() => {
                  setDelivery(o.method);
                }}
              />
              {o.title}
            </span>
            <Money
              minor={o.costMinor}
              className={`font-bold ${o.costMinor === 0 ? 'text-vape-green' : 'text-vape-glow'}`}
            />
          </label>
        ))}
      </fieldset>

      <div className="space-y-1.5 rounded-xl border border-slate-800 bg-vape-card p-3">
        <label htmlFor="username" className="block text-sm font-bold text-slate-200">
          {s.username}
        </label>
        {me.username ? (
          <p id="username" className="select-text text-sm text-vape-glow">
            @{me.username}
          </p>
        ) : (
          <>
            <p className="text-xs text-vape-muted">{s.usernameHint}</p>
            <input
              id="username"
              placeholder="@username"
              autoComplete="off"
              aria-invalid={form.formState.errors.username ? true : undefined}
              aria-describedby={form.formState.errors.username ? 'username-error' : undefined}
              className="min-h-11 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 text-sm text-white focus:border-vape-accent focus:outline-none"
              {...form.register('username')}
            />
            {form.formState.errors.username && (
              <p id="username-error" className="text-xs text-red-400">
                {form.formState.errors.username.message}
              </p>
            )}
          </>
        )}
      </div>

      <div className="space-y-2 rounded-xl border border-slate-800 bg-vape-card p-3">
        <label htmlFor="promo" className="block text-sm font-bold text-slate-200">
          {s.promo}
        </label>
        <div className="flex gap-2">
          <input
            id="promo"
            value={promoInput}
            onChange={(e) => {
              setPromoInput(e.target.value.toUpperCase());
            }}
            placeholder="VH-XXXX-XXXX"
            className="min-h-11 flex-1 rounded-xl border border-slate-800 bg-slate-900 px-3 text-sm tracking-wider text-white uppercase focus:border-vape-accent focus:outline-none"
          />
          <Button
            variant="secondary"
            disabled={!promoInput.trim()}
            onClick={() => {
              setRewardCode(promoInput.trim());
            }}
          >
            {s.apply}
          </Button>
        </div>
        {rewardCode && totals?.rewardError && (
          <p className="text-xs text-red-400" role="alert">
            {totals.rewardError}
          </p>
        )}
        {rewardCode && totals?.reward && (
          <div className="flex items-center justify-between text-xs text-vape-green">
            <span className="select-text">
              {s.promoActive(totals.reward.code)}
              {totals.reward.giftName ? ` · 🎁 ${totals.reward.giftName}` : ''}
            </span>
            <button
              type="button"
              className="min-h-11 px-2 text-slate-400 hover:text-red-400"
              onClick={() => {
                setRewardCode(null);
                setPromoInput('');
              }}
            >
              {s.reset}
            </button>
          </div>
        )}
      </div>

      {totals && (
        <PriceSummary
          itemsCount={itemsCount}
          subtotalMinor={totals.subtotalMinor}
          discountMinor={totals.discountMinor}
          deliveryCostMinor={totals.deliveryCostMinor}
          totalMinor={totals.totalMinor}
          giftName={totals.reward?.giftName ?? null}
        />
      )}

      {!me.ageConfirmed && (
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-800 bg-vape-card px-3 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={adult}
            onChange={(e) => {
              setAdult(e.target.checked);
            }}
            className="size-5 accent-vape-accent"
          />
          {s.adult}
        </label>
      )}

      {!online && <p className="text-center text-sm text-amber-300">{s.offline}</p>}
      <Button
        block
        className="min-h-12 text-base"
        pending={createOrder.isPending || confirmAge.isPending}
        disabled={!online || lines.length === 0 || (!me.ageConfirmed && !adult)}
        icon={<Send className="size-4" aria-hidden />}
        onClick={onCheckout}
      >
        {s.checkout}
      </Button>

      <OrderSuccessDialog
        order={successOrder}
        managerUsername={config.managerUsername}
        onClose={() => {
          setSuccessOrder(null);
        }}
      />
    </div>
  );
}

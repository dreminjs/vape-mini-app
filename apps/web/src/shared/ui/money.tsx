import { formatMoney } from '@vapehard/shared';

export function Money({ minor, className = '' }: { minor: number; className?: string }) {
  return <span className={`tabular-nums ${className}`}>{formatMoney(minor)}</span>;
}

interface SummaryProps {
  itemsCount: number;
  subtotalMinor: number;
  discountMinor: number;
  deliveryCostMinor: number;
  totalMinor: number;
  giftName?: string | null;
}

export function PriceSummary({
  itemsCount,
  subtotalMinor,
  discountMinor,
  deliveryCostMinor,
  totalMinor,
  giftName,
}: SummaryProps) {
  return (
    <dl className="space-y-1.5 rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm">
      <div className="flex justify-between text-vape-muted">
        <dt>Товары ({itemsCount} шт.)</dt>
        <dd>
          <Money minor={subtotalMinor} />
        </dd>
      </div>
      {discountMinor > 0 && (
        <div className="flex justify-between text-vape-green">
          <dt>Скидка по промокоду</dt>
          <dd>
            −<Money minor={discountMinor} />
          </dd>
        </div>
      )}
      {giftName && (
        <div className="flex justify-between text-vape-green">
          <dt>Подарок</dt>
          <dd>🎁 {giftName}</dd>
        </div>
      )}
      <div className="flex justify-between text-vape-muted">
        <dt>Доставка</dt>
        <dd>
          <Money minor={deliveryCostMinor} />
        </dd>
      </div>
      <div className="mt-2 flex items-baseline justify-between border-t border-slate-800 pt-2 font-bold">
        <dt className="text-white">Итого к оплате</dt>
        <dd className="text-lg text-vape-glow">
          <Money minor={totalMinor} />
        </dd>
      </div>
    </dl>
  );
}

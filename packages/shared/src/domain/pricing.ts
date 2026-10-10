import type { PrizeType } from '../constants.js';

export interface PriceLine {
  unitPriceMinor: number;
  qty: number;
}

export interface DiscountReward {
  type: PrizeType;
  /** FIXED: kopecks. PERCENT: whole percent (10 = 10%). GIFT: ignored. */
  amount: number;
}

export interface Totals {
  subtotalMinor: number;
  discountMinor: number;
  deliveryCostMinor: number;
  totalMinor: number;
}

export function calcSubtotal(lines: readonly PriceLine[]): number {
  return lines.reduce((sum, line) => sum + line.unitPriceMinor * line.qty, 0);
}

/** Percent discount rounds half up in minor units. Discount never exceeds subtotal. */
export function calcDiscount(subtotalMinor: number, reward: DiscountReward | null): number {
  if (!reward || subtotalMinor <= 0) return 0;
  switch (reward.type) {
    case 'FIXED':
      return Math.min(subtotalMinor, reward.amount);
    case 'PERCENT':
      return Math.min(subtotalMinor, Math.floor((subtotalMinor * reward.amount + 50) / 100));
    case 'GIFT':
      return 0;
  }
}

export function calcTotals(
  lines: readonly PriceLine[],
  deliveryCostMinor: number,
  reward: DiscountReward | null,
): Totals {
  const subtotalMinor = calcSubtotal(lines);
  const discountMinor = calcDiscount(subtotalMinor, reward);
  return {
    subtotalMinor,
    discountMinor,
    deliveryCostMinor,
    totalMinor: subtotalMinor - discountMinor + deliveryCostMinor,
  };
}

import { describe, expect, it } from 'vitest';

import { calcDiscount, calcSubtotal, calcTotals } from './pricing.js';

describe('calcSubtotal', () => {
  it('sums unit price × qty', () => {
    expect(
      calcSubtotal([
        { unitPriceMinor: 2800, qty: 2 },
        { unitPriceMinor: 1200, qty: 1 },
      ]),
    ).toBe(6800);
  });
  it('is 0 for empty cart', () => {
    expect(calcSubtotal([])).toBe(0);
  });
});

describe('calcDiscount', () => {
  it('returns 0 without reward', () => {
    expect(calcDiscount(1000, null)).toBe(0);
  });
  it('fixed discount is capped by subtotal', () => {
    expect(calcDiscount(300, { type: 'FIXED', amount: 500 })).toBe(300);
    expect(calcDiscount(1000, { type: 'FIXED', amount: 500 })).toBe(500);
  });
  it('percent discount rounds half up', () => {
    // 10% of 1005 = 100.5 -> 101
    expect(calcDiscount(1005, { type: 'PERCENT', amount: 10 })).toBe(101);
    // 15% of 1003 = 150.45 -> 150
    expect(calcDiscount(1003, { type: 'PERCENT', amount: 15 })).toBe(150);
  });
  it('percent never exceeds subtotal', () => {
    expect(calcDiscount(100, { type: 'PERCENT', amount: 150 })).toBe(100);
  });
  it('gift gives no money discount', () => {
    expect(calcDiscount(1000, { type: 'GIFT', amount: 0 })).toBe(0);
  });
  it('returns 0 on empty subtotal', () => {
    expect(calcDiscount(0, { type: 'FIXED', amount: 100 })).toBe(0);
  });
});

describe('calcTotals', () => {
  it('applies discount to items and adds delivery', () => {
    expect(
      calcTotals([{ unitPriceMinor: 5500, qty: 2 }], 1500, { type: 'PERCENT', amount: 10 }),
    ).toEqual({
      subtotalMinor: 11000,
      discountMinor: 1100,
      deliveryCostMinor: 1500,
      totalMinor: 11400,
    });
  });
});

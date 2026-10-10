import { describe, expect, it } from 'vitest';

import { createProductSchema, stockChangeSchema, variantListSchema } from './admin.js';
import { telegramUsernameSchema } from './common.js';
import { createOrderSchema, rewardCodeSchema } from './customer.js';

const variants = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `V${i}`, stock: 1 }));

describe('variantListSchema', () => {
  it('accepts 1..30 variants', () => {
    expect(variantListSchema.safeParse(variants(1)).success).toBe(true);
    expect(variantListSchema.safeParse(variants(30)).success).toBe(true);
  });
  it('rejects 0 and 31 variants', () => {
    expect(variantListSchema.safeParse([]).success).toBe(false);
    expect(variantListSchema.safeParse(variants(31)).success).toBe(false);
  });
  it('rejects duplicate names (case-insensitive)', () => {
    const result = variantListSchema.safeParse([
      { name: 'Mint', stock: 1 },
      { name: 'mint', stock: 2 },
    ]);
    expect(result.success).toBe(false);
  });
});

describe('createProductSchema', () => {
  const base = { name: 'Husky', categoryId: 1, priceMinor: 2800, variants: variants(1) };
  it('requires old price above price', () => {
    expect(createProductSchema.safeParse({ ...base, oldPriceMinor: 2000 }).success).toBe(false);
    expect(createProductSchema.safeParse({ ...base, oldPriceMinor: 3000 }).success).toBe(true);
  });
});

describe('stockChangeSchema', () => {
  it('accepts set or non-zero delta', () => {
    expect(stockChangeSchema.safeParse({ set: 5 }).success).toBe(true);
    expect(stockChangeSchema.safeParse({ delta: -2 }).success).toBe(true);
    expect(stockChangeSchema.safeParse({ delta: 0 }).success).toBe(false);
    expect(stockChangeSchema.safeParse({ set: -1 }).success).toBe(false);
  });
});

describe('customer schemas', () => {
  it('normalizes usernames', () => {
    expect(telegramUsernameSchema.parse('@John_Doe')).toBe('John_Doe');
    expect(telegramUsernameSchema.safeParse('ab').success).toBe(false);
  });
  it('normalizes reward codes', () => {
    expect(rewardCodeSchema.parse(' vh-5byn-a7k2 ')).toBe('VH-5BYN-A7K2');
    expect(rewardCodeSchema.safeParse('VH-anything').success).toBe(false);
  });
  it('rejects duplicate variants in an order', () => {
    const result = createOrderSchema.safeParse({
      items: [
        { variantId: 1, qty: 1 },
        { variantId: 1, qty: 2 },
      ],
      deliveryMethod: 'PICKUP',
    });
    expect(result.success).toBe(false);
  });
});

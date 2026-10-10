import { MAX_VARIANTS_PER_PRODUCT, ROULETTE_WEIGHT_TOTAL, totalWeight } from '@vapehard/shared';
import { describe, expect, it } from 'vitest';

import { PRIZES, PRODUCTS } from './seed-data.js';

describe('seed data', () => {
  it('prize weights sum to exactly 1,000,000', () => {
    expect(totalWeight(PRIZES.map((p) => p.weight))).toBe(ROULETTE_WEIGHT_TOTAL);
  });

  it('has 9 prizes and 5 products', () => {
    expect(PRIZES).toHaveLength(9);
    expect(PRODUCTS).toHaveLength(5);
  });

  it('every product has 1..30 variants with unique names', () => {
    for (const p of PRODUCTS) {
      expect(p.variants.length).toBeGreaterThanOrEqual(1);
      expect(p.variants.length).toBeLessThanOrEqual(MAX_VARIANTS_PER_PRODUCT);
      expect(new Set(p.variants.map((v) => v.name)).size).toBe(p.variants.length);
    }
  });
});

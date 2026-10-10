import { describe, expect, it } from 'vitest';

import {
  addToCart,
  cartItemCount,
  removeLine,
  setLineQty,
  syncCartWithServer,
  type CartLine,
} from './cart.js';

const line = (variantId: number, qty: number, maxStock = 5, price = 1000): CartLine => ({
  productId: 1,
  variantId,
  productName: 'P',
  variantName: `V${variantId}`,
  unitPriceMinor: price,
  imageUrl: null,
  qty,
  maxStock,
});

describe('addToCart', () => {
  it('adds a new line', () => {
    expect(addToCart([], [line(1, 2)])).toEqual([line(1, 2)]);
  });
  it('merges by variant and clamps to stock', () => {
    const cart = addToCart([line(1, 4)], [line(1, 3)]);
    expect(cart).toHaveLength(1);
    expect(cart[0]?.qty).toBe(5);
  });
  it('drops lines with zero stock', () => {
    expect(addToCart([], [line(1, 2, 0)])).toEqual([]);
  });
  it('does not mutate input', () => {
    const cart = [line(1, 1)];
    addToCart(cart, [line(1, 1)]);
    expect(cart[0]?.qty).toBe(1);
  });
});

describe('setLineQty / removeLine / count', () => {
  it('clamps and removes on 0', () => {
    expect(setLineQty([line(1, 1)], 1, 10)[0]?.qty).toBe(5);
    expect(setLineQty([line(1, 1)], 1, 0)).toEqual([]);
    expect(setLineQty([line(1, 1), line(2, 1)], 2, 3).map((l) => l.qty)).toEqual([1, 3]);
  });
  it('removes a line', () => {
    expect(removeLine([line(1, 1), line(2, 1)], 1)).toEqual([line(2, 1)]);
  });
  it('counts items', () => {
    expect(cartItemCount([line(1, 2), line(2, 3)])).toBe(5);
  });
});

describe('syncCartWithServer', () => {
  it('reports price changes, stock reductions and removals', () => {
    const result = syncCartWithServer(
      [line(1, 2), line(2, 4), line(3, 1), line(4, 1)],
      [
        { variantId: 1, unitPriceMinor: 1200, availableStock: 5, available: true },
        { variantId: 2, unitPriceMinor: 1000, availableStock: 2, available: true },
        { variantId: 3, unitPriceMinor: 1000, availableStock: 0, available: true },
      ],
    );
    expect(result.priceChanged).toEqual([1]);
    expect(result.stockReduced).toEqual([2]);
    expect(result.removed).toEqual([3, 4]);
    expect(result.cart.map((l) => [l.variantId, l.qty, l.unitPriceMinor])).toEqual([
      [1, 2, 1200],
      [2, 2, 1000],
    ]);
  });
});

import { describe, expect, it } from 'vitest';

import { getDeliveryOption } from '../constants.js';

import { bynToMinor, formatMoney, formatOrderNumber, minorToByn } from './money.js';

describe('money', () => {
  it('converts without float noise', () => {
    expect(bynToMinor(0.1 + 0.2)).toBe(30);
    expect(minorToByn(1550)).toBe(15.5);
  });
  it('formats BYN', () => {
    expect(formatMoney(2800)).toMatch(/28,00/);
  });
  it('formats order number', () => {
    expect(formatOrderNumber(1001)).toBe('VH-1001');
  });
  it('finds delivery options and rejects unknown', () => {
    expect(getDeliveryOption('COURIER').costMinor).toBe(1500);
    expect(() => getDeliveryOption('X' as never)).toThrow();
  });
});

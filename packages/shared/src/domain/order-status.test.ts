import { describe, expect, it } from 'vitest';

import { ORDER_STATUSES } from '../constants.js';

import { canTransition, isFinalStatus, nextStatuses } from './order-status.js';

const ALLOWED = new Set([
  'PROCESSING>HANDED_TO_COURIER',
  'HANDED_TO_COURIER>COMPLETED',
  'PROCESSING>CANCELLED',
  'HANDED_TO_COURIER>CANCELLED',
]);

describe('order status machine', () => {
  it('allows only the documented moves', () => {
    for (const from of ORDER_STATUSES) {
      for (const to of ORDER_STATUSES) {
        expect(canTransition(from, to), `${from} -> ${to}`).toBe(ALLOWED.has(`${from}>${to}`));
      }
    }
  });

  it('final statuses have no next status', () => {
    expect(isFinalStatus('COMPLETED')).toBe(true);
    expect(isFinalStatus('CANCELLED')).toBe(true);
    expect(isFinalStatus('PROCESSING')).toBe(false);
    expect(nextStatuses('PROCESSING')).toEqual(['HANDED_TO_COURIER', 'CANCELLED']);
  });
});

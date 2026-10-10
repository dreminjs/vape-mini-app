import { describe, expect, it } from 'vitest';

import {
  generateRewardCode,
  nextSpinAt,
  pickWeightedIndex,
  totalWeight,
  wheelTargetAngle,
} from './roulette.js';

const SEED_WEIGHTS = [160000, 160000, 160000, 160000, 120000, 120000, 118999, 1000, 1];

describe('pickWeightedIndex', () => {
  it('seed weights sum to exactly 1,000,000', () => {
    expect(totalWeight(SEED_WEIGHTS)).toBe(1_000_000);
  });

  it('maps tickets to ranges at the boundaries', () => {
    expect(pickWeightedIndex(SEED_WEIGHTS, () => 0)).toBe(0);
    expect(pickWeightedIndex(SEED_WEIGHTS, () => 159_999)).toBe(0);
    expect(pickWeightedIndex(SEED_WEIGHTS, () => 160_000)).toBe(1);
    expect(pickWeightedIndex(SEED_WEIGHTS, () => 999_998)).toBe(7);
    expect(pickWeightedIndex(SEED_WEIGHTS, () => 999_999)).toBe(8);
  });

  it('never picks a zero-weight prize', () => {
    expect(pickWeightedIndex([0, 5, 0], () => 4)).toBe(1);
  });

  it('passes the total to the random source', () => {
    let seen = 0;
    pickWeightedIndex([3, 7], (max) => {
      seen = max;
      return 0;
    });
    expect(seen).toBe(10);
  });

  it('rejects bad weights and bad random values', () => {
    expect(() => pickWeightedIndex([0, 0], () => 0)).toThrow();
    expect(() => pickWeightedIndex([1.5, 2], () => 0)).toThrow();
    expect(() => pickWeightedIndex([1, 2], () => 3)).toThrow();
  });

  it('distribution follows weights', () => {
    const counts = [0, 0];
    let i = 0;
    for (let n = 0; n < 1000; n++) {
      const index = pickWeightedIndex([1, 3], () => i++ % 4);
      counts[index] = (counts[index] ?? 0) + 1;
    }
    expect(counts).toEqual([250, 750]);
  });
});

describe('generateRewardCode', () => {
  it('builds VH-<key>-XXXX from the alphabet', () => {
    expect(generateRewardCode('5BYN', () => 0)).toBe('VH-5BYN-AAAA');
    expect(generateRewardCode('10PCT', (max) => max - 1)).toMatch(/^VH-10PCT-[A-Z2-9]{4}$/);
  });
});

describe('nextSpinAt', () => {
  it('is null when the user never spun', () => {
    expect(nextSpinAt(null, 1000)).toBeNull();
  });
  it('adds the cooldown', () => {
    expect(nextSpinAt(new Date(0), 1000)?.getTime()).toBe(1000);
  });
});

describe('wheelTargetAngle', () => {
  it('lands the pointer on the segment center after 5 turns', () => {
    expect(wheelTargetAngle(0, 0, 9)).toBe(1800 + 340);
    expect(wheelTargetAngle(100, 8, 9)).toBe(360 + 1800 + 20);
  });
});

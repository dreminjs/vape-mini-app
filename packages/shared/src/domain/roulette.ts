/** Random source: returns an integer in [0, max). Injected so tests are deterministic. */
export type RandomInt = (max: number) => number;

export function totalWeight(weights: readonly number[]): number {
  return weights.reduce((sum, w) => sum + w, 0);
}

/**
 * Picks an index by integer weights. `random(total)` gives a ticket in [0, total);
 * the prize whose range contains the ticket wins.
 */
export function pickWeightedIndex(weights: readonly number[], random: RandomInt): number {
  const total = totalWeight(weights);
  if (total <= 0) throw new Error('Weights must sum to a positive number');
  if (weights.some((w) => !Number.isInteger(w) || w < 0)) {
    throw new Error('Weights must be non-negative integers');
  }
  const ticket = random(total);
  let upper = 0;
  for (const [index, weight] of weights.entries()) {
    upper += weight;
    if (ticket < upper) return index;
  }
  // Unreachable when random respects its contract.
  throw new Error(`Ticket ${ticket} is out of range ${total}`);
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Code like VH-5BYN-A7K2. Ambiguous chars (0/O, 1/I) are excluded. */
export function generateRewardCode(prizeKey: string, random: RandomInt, length = 4): string {
  let suffix = '';
  for (let i = 0; i < length; i++) {
    suffix += CODE_ALPHABET.charAt(random(CODE_ALPHABET.length));
  }
  return `VH-${prizeKey}-${suffix}`;
}

export function nextSpinAt(lastSpinAt: Date | null, cooldownMs: number): Date | null {
  if (!lastSpinAt) return null;
  return new Date(lastSpinAt.getTime() + cooldownMs);
}

/** Wheel rotation (degrees) so the pointer at the top lands on the center of `index`. */
export function wheelTargetAngle(currentAngle: number, index: number, segments: number): number {
  const seg = 360 / segments;
  const base = Math.ceil(currentAngle / 360) * 360;
  return base + 360 * 5 + (360 - index * seg - seg / 2);
}

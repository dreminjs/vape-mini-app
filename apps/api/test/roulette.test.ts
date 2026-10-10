import { beforeEach, describe, expect, it } from 'vitest';

import { adultUser, call, makeContext, resetDb, testDb } from './helpers.js';

beforeEach(async () => {
  await resetDb();
  await adultUser(1);
});

describe('roulette', () => {
  it('spins once, creates a personal reward and enforces the cooldown', async () => {
    const ctx = makeContext({ randomInt: () => 0 });
    const first = await call(ctx, 'POST', '/roulette/spin', { tgId: 1 });
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({
      prizeIndex: 0,
      prize: { key: '5BYN' },
      reward: {
        code: 'VH-5BYN-AAAA',
        type: 'FIXED',
        amount: 500,
        expiresAt: '2026-10-17T12:00:00.000Z',
      },
      nextSpinAt: '2026-10-11T12:00:00.000Z',
    });

    const second = await call(ctx, 'POST', '/roulette/spin', { tgId: 1 });
    expect(second.status).toBe(409);
    expect(second.body.error?.code).toBe('ROULETTE_COOLDOWN');

    const state = await call(ctx, 'GET', '/roulette/state', { tgId: 1 });
    expect(state.body).toMatchObject({
      nextSpinAt: '2026-10-11T12:00:00.000Z',
      rewards: [{ code: 'VH-5BYN-AAAA' }],
    });

    ctx.now.value = new Date('2026-10-11T12:00:01Z');
    expect((await call(ctx, 'POST', '/roulette/spin', { tgId: 1 })).status).toBe(200);
  });

  it('two parallel spins: exactly one succeeds', async () => {
    const ctx = makeContext();
    const results = await Promise.all([
      call(ctx, 'POST', '/roulette/spin', { tgId: 1 }),
      call(ctx, 'POST', '/roulette/spin', { tgId: 1 }),
      call(ctx, 'POST', '/roulette/spin', { tgId: 1 }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409, 409]);
    expect(await testDb().rouletteSpin.count()).toBe(1);
    expect(await testDb().reward.count()).toBe(1);
  });

  it('gift prize stores the gift name on the reward', async () => {
    // Ticket 999_999 falls into the last prize (weight 1).
    const ctx = makeContext({ randomInt: (max) => max - 1 });
    const res = await call(ctx, 'POST', '/roulette/spin', { tgId: 1 });
    expect(res.body).toMatchObject({
      prizeIndex: 2,
      reward: { type: 'GIFT', giftName: 'Картридж в подарок' },
    });
  });

  it('state never exposes weights', async () => {
    const ctx = makeContext();
    const state = await call(ctx, 'GET', '/roulette/state', { tgId: 1 });
    expect(JSON.stringify(state.body)).not.toContain('weight');
  });
});

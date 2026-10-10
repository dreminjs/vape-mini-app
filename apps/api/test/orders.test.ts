import { beforeEach, describe, expect, it } from 'vitest';

import { ADMIN_TG_ID, adultUser, call, makeContext, resetDb, testDb } from './helpers.js';

let ids: Awaited<ReturnType<typeof resetDb>>;

beforeEach(async () => {
  ids = await resetDb();
  await adultUser(1);
  await adultUser(2);
  await adultUser(ADMIN_TG_ID, 'ADMIN');
});

const order = (variantId: number, qty: number, extra: Record<string, unknown> = {}) => ({
  items: [{ variantId, qty }],
  deliveryMethod: 'COURIER',
  ...extra,
});

describe('POST /orders', () => {
  it('creates an order with server prices, reduces stock, writes ledger and outbox', async () => {
    const ctx = makeContext();
    const res = await call(ctx, 'POST', '/orders', {
      tgId: 1,
      body: { ...order(ids.mintId, 2), unitPriceMinor: 1 },
      headers: { 'idempotency-key': 'key-00000001' },
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      displayNumber: 'VH-1001',
      subtotalMinor: 5600,
      deliveryCostMinor: 1500,
      totalMinor: 7100,
      status: 'PROCESSING',
      contactUsername: 'user1',
    });
    const db = testDb();
    expect((await db.variant.findUniqueOrThrow({ where: { id: ids.mintId } })).stock).toBe(3);
    expect(await db.stockMovement.count({ where: { reason: 'ORDER', delta: -2 } })).toBe(1);
    expect(await db.outboxMessage.count({ where: { type: 'order.created' } })).toBe(1);
  });

  it('requires an Idempotency-Key header', async () => {
    const ctx = makeContext();
    const res = await call(ctx, 'POST', '/orders', { tgId: 1, body: order(ids.mintId, 1) });
    expect(res.status).toBe(400);
    expect(res.body.error?.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('returns the same order for a repeated key (also in parallel)', async () => {
    const ctx = makeContext();
    const send = () =>
      call(ctx, 'POST', '/orders', {
        tgId: 1,
        body: order(ids.mintId, 1),
        headers: { 'idempotency-key': 'same-key-123' },
      });
    const results = await Promise.all([send(), send(), send()]);
    const numbers = new Set(results.map((r) => r.body.number));
    expect(numbers.size).toBe(1);
    expect(await testDb().order.count()).toBe(1);
    expect((await testDb().variant.findUniqueOrThrow({ where: { id: ids.mintId } })).stock).toBe(4);
  });

  it('two parallel orders for the last item: exactly one succeeds', async () => {
    const ctx = makeContext();
    const [a, b] = await Promise.all([
      call(ctx, 'POST', '/orders', {
        tgId: 1,
        body: order(ids.lastId, 1),
        headers: { 'idempotency-key': 'race-a-0001' },
      }),
      call(ctx, 'POST', '/orders', {
        tgId: 2,
        body: order(ids.lastId, 1),
        headers: { 'idempotency-key': 'race-b-0001' },
      }),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const loser = a.status === 409 ? a : b;
    expect(loser.body.error?.code).toBe('OUT_OF_STOCK');
    expect((await testDb().variant.findUniqueOrThrow({ where: { id: ids.lastId } })).stock).toBe(0);
    expect(await testDb().order.count()).toBe(1);
  });

  it('rolls back all lines when one line is out of stock', async () => {
    const ctx = makeContext();
    const res = await call(ctx, 'POST', '/orders', {
      tgId: 1,
      body: {
        items: [
          { variantId: ids.mintId, qty: 1 },
          { variantId: ids.lastId, qty: 2 },
        ],
        deliveryMethod: 'PICKUP',
      },
      headers: { 'idempotency-key': 'rollback-01' },
    });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      error: {
        details: { items: [{ variantId: ids.lastId, reason: 'NOT_ENOUGH_STOCK', available: 1 }] },
      },
    });
    expect((await testDb().variant.findUniqueOrThrow({ where: { id: ids.mintId } })).stock).toBe(5);
  });

  it('asks for a username when Telegram has none', async () => {
    const ctx = makeContext();
    await testDb().user.update({ where: { telegramId: 1n }, data: { username: null } });
    const { authHeader } = await import('./helpers.js');
    const headers = { ...authHeader(ctx, 1, null), 'idempotency-key': 'nouser-001' };
    const noName = await call(ctx, 'POST', '/orders', { body: order(ids.mintId, 1), headers });
    expect(noName.status).toBe(400);
    const ok = await call(ctx, 'POST', '/orders', {
      body: order(ids.mintId, 1, { contactUsername: '@typed_name' }),
      headers,
    });
    expect(ok.status).toBe(201);
    expect(ok.body.contactUsername).toBe('typed_name');
  });
});

describe('rewards in checkout', () => {
  async function reward(code: string, userTg: number, data: Record<string, unknown> = {}) {
    const db = testDb();
    const user = await db.user.findUniqueOrThrow({ where: { telegramId: BigInt(userTg) } });
    const prize = await db.roulettePrize.findFirstOrThrow({ where: { key: '10PCT' } });
    return db.reward.create({
      data: {
        code,
        userId: user.id,
        prizeId: prize.id,
        type: 'PERCENT',
        amount: 10,
        expiresAt: new Date('2026-10-17T12:00:00Z'),
        ...data,
      },
    });
  }

  it('applies a percent reward once', async () => {
    const ctx = makeContext();
    await reward('VH-10PCT-AAAA', 1);
    const first = await call(ctx, 'POST', '/orders', {
      tgId: 1,
      body: order(ids.mintId, 1, { rewardCode: 'vh-10pct-aaaa' }),
      headers: { 'idempotency-key': 'reward-001' },
    });
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ discountMinor: 280, totalMinor: 2800 - 280 + 1500 });

    const second = await call(ctx, 'POST', '/orders', {
      tgId: 1,
      body: order(ids.mintId, 1, { rewardCode: 'VH-10PCT-AAAA' }),
      headers: { 'idempotency-key': 'reward-002' },
    });
    expect(second.status).toBe(409);
    expect(second.body.error?.code).toBe('REWARD_INVALID');
    expect((await testDb().variant.findUniqueOrThrow({ where: { id: ids.mintId } })).stock).toBe(4);
  });

  it('rejects rewards of another user and expired rewards', async () => {
    const ctx = makeContext();
    await reward('VH-10PCT-BBBB', 2);
    await reward('VH-10PCT-CCCC', 1, { expiresAt: new Date('2026-10-01') });
    for (const [code, key] of [
      ['VH-10PCT-BBBB', 'other-01'],
      ['VH-10PCT-CCCC', 'expired-1'],
    ]) {
      const res = await call(ctx, 'POST', '/orders', {
        tgId: 1,
        body: order(ids.mintId, 1, { rewardCode: code }),
        headers: { 'idempotency-key': key ?? '' },
      });
      expect(res.status).toBe(409);
    }
  });
});

describe('status changes', () => {
  async function placeOrder(ctx: ReturnType<typeof makeContext>) {
    const res = await call(ctx, 'POST', '/orders', {
      tgId: 1,
      body: order(ids.mintId, 2),
      headers: { 'idempotency-key': 'status-0001' },
    });
    return res.body.id as number;
  }

  it('follows the status machine and notifies the customer', async () => {
    const ctx = makeContext();
    const id = await placeOrder(ctx);
    const bad = await call(ctx, 'PATCH', `/admin/orders/${id}/status`, {
      tgId: ADMIN_TG_ID,
      body: { status: 'COMPLETED' },
    });
    expect(bad.status).toBe(409);
    expect(bad.body.error?.code).toBe('INVALID_STATUS_TRANSITION');

    for (const status of ['HANDED_TO_COURIER', 'COMPLETED']) {
      const res = await call(ctx, 'PATCH', `/admin/orders/${id}/status`, {
        tgId: ADMIN_TG_ID,
        body: { status },
      });
      expect(res.status).toBe(200);
    }
    expect(await testDb().outboxMessage.count({ where: { type: 'order.status_changed' } })).toBe(2);
    expect(await testDb().auditLog.count({ where: { action: 'order.status' } })).toBe(2);
  });

  it('cancel restores stock and frees a non-expired reward', async () => {
    const ctx = makeContext();
    const db = testDb();
    const user = await db.user.findUniqueOrThrow({ where: { telegramId: 1n } });
    const prize = await db.roulettePrize.findFirstOrThrow({ where: { key: '5BYN' } });
    await db.reward.create({
      data: {
        code: 'VH-5BYN-DDDD',
        userId: user.id,
        prizeId: prize.id,
        type: 'FIXED',
        amount: 500,
        expiresAt: new Date('2026-10-17'),
      },
    });
    const res = await call(ctx, 'POST', '/orders', {
      tgId: 1,
      body: order(ids.mintId, 2, { rewardCode: 'VH-5BYN-DDDD' }),
      headers: { 'idempotency-key': 'cancel-0001' },
    });
    expect((await db.variant.findUniqueOrThrow({ where: { id: ids.mintId } })).stock).toBe(3);

    const cancel = await call(ctx, 'PATCH', `/admin/orders/${String(res.body.id)}/status`, {
      tgId: ADMIN_TG_ID,
      body: { status: 'CANCELLED' },
    });
    expect(cancel.status).toBe(200);
    expect((await db.variant.findUniqueOrThrow({ where: { id: ids.mintId } })).stock).toBe(5);
    expect(await db.stockMovement.count({ where: { reason: 'CANCEL', delta: 2 } })).toBe(1);
    expect(
      (await db.reward.findUniqueOrThrow({ where: { code: 'VH-5BYN-DDDD' } })).usedAt,
    ).toBeNull();
  });
});

describe('cart validate and customer orders', () => {
  it('reports stock problems and current prices', async () => {
    const ctx = makeContext();
    const res = await call(ctx, 'POST', '/cart/validate', {
      tgId: 1,
      body: {
        items: [
          { variantId: ids.lastId, qty: 3 },
          { variantId: 99999, qty: 1 },
        ],
        deliveryMethod: 'EVROPOCHTA',
      },
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      lines: [
        { variantId: ids.lastId, qty: 1, issue: 'NOT_ENOUGH_STOCK', unitPriceMinor: 2800 },
        { variantId: 99999, available: false, issue: 'NOT_AVAILABLE' },
      ],
      subtotalMinor: 2800,
      deliveryCostMinor: 600,
      totalMinor: 3400,
    });
  });

  it('lists only own orders', async () => {
    const ctx = makeContext();
    await call(ctx, 'POST', '/orders', {
      tgId: 1,
      body: order(ids.mintId, 1),
      headers: { 'idempotency-key': 'own-000001' },
    });
    const own = await call(ctx, 'GET', '/orders', { tgId: 1 });
    const other = await call(ctx, 'GET', '/orders', { tgId: 2 });
    expect((own.body.items as unknown[]).length).toBe(1);
    expect((other.body.items as unknown[]).length).toBe(0);
    const id = (own.body.items as { id: number }[])[0]?.id;
    expect((await call(ctx, 'GET', `/orders/${String(id)}`, { tgId: 2 })).status).toBe(404);
  });
});

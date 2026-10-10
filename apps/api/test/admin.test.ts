import { beforeEach, describe, expect, it } from 'vitest';

import { ADMIN_TG_ID, adultUser, call, makeContext, resetDb, testDb } from './helpers.js';

let ids: Awaited<ReturnType<typeof resetDb>>;

beforeEach(async () => {
  ids = await resetDb();
  await adultUser(ADMIN_TG_ID, 'ADMIN');
});

const variants = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `V${i}`, stock: 1 }));

describe('admin products', () => {
  it('creates a product with 1..30 variants and rejects 31', async () => {
    const ctx = makeContext();
    const body = {
      name: 'New pod',
      categoryId: ids.categoryId,
      priceMinor: 9900,
      variants: variants(30),
    };
    const ok = await call(ctx, 'POST', '/admin/products', { tgId: ADMIN_TG_ID, body });
    expect(ok.status).toBe(201);
    expect((ok.body.variants as unknown[]).length).toBe(30);

    const tooMany = await call(ctx, 'POST', '/admin/products', {
      tgId: ADMIN_TG_ID,
      body: { ...body, variants: variants(31) },
    });
    expect(tooMany.status).toBe(400);
    expect(await testDb().stockMovement.count({ where: { reason: 'INITIAL' } })).toBe(30);
  });

  it('checks that the uploaded image exists and deletes the old one', async () => {
    const ctx = makeContext();
    const missing = await call(ctx, 'PATCH', `/admin/products/${String(ids.productId)}`, {
      tgId: ADMIN_TG_ID,
      body: { imageKey: 'products/a.png' },
    });
    expect(missing.status).toBe(400);

    ctx.storage.objects.add('products/a.png').add('products/b.png');
    await call(ctx, 'PATCH', `/admin/products/${String(ids.productId)}`, {
      tgId: ADMIN_TG_ID,
      body: { imageKey: 'products/a.png' },
    });
    const res = await call(ctx, 'PATCH', `/admin/products/${String(ids.productId)}`, {
      tgId: ADMIN_TG_ID,
      body: { imageKey: 'products/b.png' },
    });
    expect(res.status).toBe(200);
    expect(res.body.imageUrl).toBe('https://example.test/media/vapehard/products/b.png');
    expect(ctx.storage.removed).toEqual(['products/a.png']);
  });

  it('archives a product and hides it from the catalog', async () => {
    const ctx = makeContext();
    await call(ctx, 'POST', `/admin/products/${String(ids.productId)}/archive`, {
      tgId: ADMIN_TG_ID,
    });
    const list = await call(ctx, 'GET', '/products', { tgId: ADMIN_TG_ID });
    expect(list.body.items).toEqual([]);
  });

  it('replaces variants, swaps names and writes the ledger', async () => {
    const ctx = makeContext();
    const res = await call(ctx, 'PUT', `/admin/products/${String(ids.productId)}/variants`, {
      tgId: ADMIN_TG_ID,
      body: {
        variants: [
          { id: ids.lastId, name: 'Mint', stock: 4 },
          { id: ids.mintId, name: 'Last one', stock: 5 },
          { name: 'Brand new', stock: 7 },
        ],
      },
    });
    expect(res.status).toBe(200);
    expect(res.body.variants).toMatchObject([
      { id: ids.lastId, name: 'Mint', stock: 4 },
      { id: ids.mintId, name: 'Last one', stock: 5 },
      { name: 'Brand new', stock: 7 },
    ]);
    expect(
      await testDb().stockMovement.count({ where: { reason: 'ADMIN_ADJUST', delta: 3 } }),
    ).toBe(1);
  });

  it('changes stock by set and delta, never below zero', async () => {
    const ctx = makeContext();
    const path = `/admin/variants/${String(ids.mintId)}/stock`;
    expect((await call(ctx, 'POST', path, { tgId: ADMIN_TG_ID, body: { set: 10 } })).body).toEqual({
      id: ids.mintId,
      stock: 10,
    });
    expect(
      (await call(ctx, 'POST', path, { tgId: ADMIN_TG_ID, body: { delta: -3 } })).body,
    ).toEqual({ id: ids.mintId, stock: 7 });
    expect((await call(ctx, 'POST', path, { tgId: ADMIN_TG_ID, body: { delta: -8 } })).status).toBe(
      409,
    );
    expect(await testDb().auditLog.count({ where: { action: 'variant.stock' } })).toBe(2);
  });
});

describe('admin analytics and odds', () => {
  it('summarizes revenue of completed orders and stock', async () => {
    const ctx = makeContext();
    const res = await call(ctx, 'GET', '/admin/analytics/summary', { tgId: ADMIN_TG_ID });
    expect(res.body).toMatchObject({ revenueMinor: 0, totalStock: 6, ordersCount: 0 });
  });

  it('shows probabilities to admins', async () => {
    const ctx = makeContext();
    const res = await call(ctx, 'GET', '/admin/roulette/prizes', { tgId: ADMIN_TG_ID });
    expect(res.body).toMatchObject([
      { key: '5BYN', probability: 0.5 },
      {},
      { probability: 0.000001 },
    ]);
  });

  it('presigns uploads only for images', async () => {
    const ctx = makeContext();
    const ok = await call(ctx, 'POST', '/admin/uploads/presign', {
      tgId: ADMIN_TG_ID,
      body: { contentType: 'image/webp', size: 1000 },
    });
    expect(ok.body.key).toMatch(/^products\/[0-9a-f-]+\.webp$/);
    const bad = await call(ctx, 'POST', '/admin/uploads/presign', {
      tgId: ADMIN_TG_ID,
      body: { contentType: 'text/html', size: 1000 },
    });
    expect(bad.status).toBe(400);
  });
});

describe('health', () => {
  it('healthz and readyz respond', async () => {
    const ctx = makeContext();
    expect((await ctx.app.request('/healthz')).status).toBe(200);
    expect((await ctx.app.request('/readyz')).status).toBe(200);
  });
});

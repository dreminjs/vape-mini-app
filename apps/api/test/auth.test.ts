import { beforeEach, describe, expect, it } from 'vitest';

import { ADMIN_TG_ID, adultUser, call, makeContext, resetDb, testDb } from './helpers.js';

const ADMIN_ROUTES: [string, string, unknown?][] = [
  ['GET', '/admin/products'],
  ['GET', '/admin/products/1'],
  ['POST', '/admin/products', {}],
  ['PATCH', '/admin/products/1', {}],
  ['POST', '/admin/products/1/archive'],
  ['PUT', '/admin/products/1/variants', { variants: [] }],
  ['POST', '/admin/variants/1/stock', { set: 1 }],
  ['GET', '/admin/orders'],
  ['PATCH', '/admin/orders/1/status', { status: 'COMPLETED' }],
  ['GET', '/admin/analytics/summary'],
  ['GET', '/admin/roulette/prizes'],
  ['POST', '/admin/uploads/presign', { contentType: 'image/png', size: 10 }],
];

describe('auth', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('rejects requests without initData', async () => {
    const ctx = makeContext();
    const res = await call(ctx, 'GET', '/me');
    expect(res.status).toBe(401);
    expect(res.body.error?.code).toBe('UNAUTHORIZED');
  });

  it('rejects expired initData', async () => {
    const ctx = makeContext();
    const headers = { authorization: '' };
    ({ authorization: headers.authorization } = (await import('./helpers.js')).authHeader(ctx, 1));
    ctx.now.value = new Date(ctx.now.value.getTime() + 2 * 3600 * 1000);
    const res = await call(ctx, 'GET', '/me', { headers });
    expect(res.status).toBe(401);
  });

  it('creates the user and requires the age gate for the shop', async () => {
    const ctx = makeContext();
    const me = await call(ctx, 'GET', '/me', { tgId: 1 });
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ telegramId: '1', ageConfirmed: false, isAdmin: false });

    const blocked = await call(ctx, 'GET', '/products', { tgId: 1 });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error?.code).toBe('AGE_NOT_CONFIRMED');

    await call(ctx, 'POST', '/me/confirm-age', { tgId: 1 });
    expect((await call(ctx, 'GET', '/products', { tgId: 1 })).status).toBe(200);
  });

  it('promotes ids from ADMIN_TELEGRAM_IDS', async () => {
    const ctx = makeContext();
    const me = await call(ctx, 'GET', '/me', { tgId: ADMIN_TG_ID });
    expect(me.body).toMatchObject({ role: 'ADMIN', isAdmin: true });
  });

  it.each(ADMIN_ROUTES)('customer gets 403 on %s %s', async (method, path, body) => {
    const ctx = makeContext();
    await adultUser(2);
    const res = await call(ctx, method, path, { tgId: 2, body });
    expect(res.status).toBe(403);
    expect(res.body.error?.code).toBe('FORBIDDEN');
  });

  it('a role in the DB cannot be faked by the client', async () => {
    const ctx = makeContext();
    await adultUser(3);
    await call(ctx, 'GET', '/me', { tgId: 3, body: undefined, headers: { 'x-role': 'ADMIN' } });
    const user = await testDb().user.findUniqueOrThrow({ where: { telegramId: 3n } });
    expect(user.role).toBe('CUSTOMER');
  });
});

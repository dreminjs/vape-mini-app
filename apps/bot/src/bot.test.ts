import type { PrismaClient } from '@vapehard/db';
import type { OrderNotificationSnapshot } from '@vapehard/shared';
import { pino } from 'pino';
import { describe, expect, it } from 'vitest';

import { handlers, type BotDeps } from './bot.js';
import { escapeHtml, t } from './messages.ru.js';
import { backoffMs } from './outbox-worker.js';

function fakeCtx(from: { id: number; first_name: string } | undefined) {
  const replies: { text: string; other: unknown }[] = [];
  return {
    ctx: {
      from: from && { ...from, is_bot: false },
      reply: (text: string, other?: unknown) => {
        replies.push({ text, other });
        return Promise.resolve({} as never);
      },
    },
    replies,
  };
}

function deps(db: Partial<Record<string, unknown>> = {}): BotDeps {
  return {
    db: db as unknown as PrismaClient,
    log: pino({ level: 'silent' }),
    clock: () => new Date('2026-10-10T12:00:00Z'),
    webAppUrl: 'https://shop.test',
    managerUsername: 'VapeHard_manager',
  };
}

describe('/start', () => {
  it('greets with an escaped name, 18+ notice and a Web App button', async () => {
    const { ctx, replies } = fakeCtx({ id: 1, first_name: '<Тим>' });
    await handlers.start(ctx, deps());
    expect(replies[0]?.text).toContain('&lt;Тим&gt;');
    expect(replies[0]?.text).toContain('18');
    expect(JSON.stringify(replies[0]?.other)).toContain('"web_app":{"url":"https://shop.test"}');
  });
});

describe('/help and /stats', () => {
  it('help mentions the manager', async () => {
    const { ctx, replies } = fakeCtx({ id: 1, first_name: 'A' });
    await handlers.help(ctx, deps());
    expect(replies[0]?.text).toContain('@VapeHard_manager');
  });

  it('stats is admin only', async () => {
    const { ctx, replies } = fakeCtx({ id: 1, first_name: 'A' });
    const db = { user: { findUnique: () => Promise.resolve({ role: 'CUSTOMER' }) } };
    await handlers.stats(ctx, deps(db));
    expect(replies[0]?.text).toBe(t.notAdmin);
  });

  it('orders shows an empty state', async () => {
    const { ctx, replies } = fakeCtx({ id: 1, first_name: 'A' });
    await handlers.orders(ctx, deps({ order: { findMany: () => Promise.resolve([]) } }));
    expect(replies[0]?.text).toBe(t.noOrders);
  });
});

describe('messages', () => {
  const snapshot: OrderNotificationSnapshot = {
    orderId: 1,
    number: 1001,
    status: 'PROCESSING',
    deliveryMethod: 'COURIER',
    subtotalMinor: 5600,
    discountMinor: 500,
    deliveryCostMinor: 1500,
    totalMinor: 6600,
    giftName: null,
    contactUsername: 'buyer_1',
    customer: { telegramId: '42', username: 'buyer_1', firstName: '<b>x</b>' },
    items: [{ productName: 'Husky & Co', variantName: 'Mint', qty: 2, unitPriceMinor: 2800 }],
  };

  it('manager message has number, items, total and customer links', () => {
    const text = t.managerNewOrder(snapshot);
    expect(text).toContain('VH-1001');
    expect(text).toContain('Husky &amp; Co');
    expect(text).toContain('tg://user?id=42');
    expect(text).toContain('@buyer_1');
    expect(text).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(text).toContain('Курьер по Минску');
  });

  it('escapes html', () => {
    expect(escapeHtml('a<b>&c')).toBe('a&lt;b&gt;&amp;c');
  });

  it('backoff grows exponentially with a cap', () => {
    expect(backoffMs(1)).toBe(5000);
    expect(backoffMs(3)).toBe(20000);
    expect(backoffMs(30)).toBe(3_600_000);
  });
});

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { createPrismaClient, type Prisma } from '@vapehard/db';
import type { OrderNotificationSnapshot } from '@vapehard/shared';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { processOutboxBatch, type Sender } from '../src/outbox-worker.js';

const rootEnv = resolve(import.meta.dirname, '../../../.env');
if (!process.env.TEST_DATABASE_URL && existsSync(rootEnv)) process.loadEnvFile(rootEnv);
const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL is required');
const db = createPrismaClient(url);
afterAll(() => db.$disconnect());

const snapshot = (telegramId: string): OrderNotificationSnapshot => ({
  orderId: 1,
  number: 1001,
  status: 'HANDED_TO_COURIER',
  deliveryMethod: 'PICKUP',
  subtotalMinor: 1000,
  discountMinor: 0,
  deliveryCostMinor: 0,
  totalMinor: 1000,
  giftName: null,
  contactUsername: 'buyer_1',
  customer: { telegramId, username: 'buyer_1', firstName: 'B' },
  items: [{ productName: 'P', variantName: 'V', qty: 1, unitPriceMinor: 1000 }],
});

/** Fake Telegram: records calls and fails for chosen chats. */
class FakeTelegram implements Sender {
  sent: { chatId: string; text: string }[] = [];
  failures = new Map<string, number>();
  sendMessage(chatId: string, text: string) {
    const code = this.failures.get(chatId);
    if (code)
      return Promise.reject(Object.assign(new Error(`Telegram ${code}`), { error_code: code }));
    this.sent.push({ chatId, text });
    return Promise.resolve();
  }
}

const now = new Date('2026-10-10T12:00:00Z');
const workerDeps = (sender: Sender, maxAttempts = 3) => ({
  db,
  sender,
  log: pino({ level: 'silent' }),
  clock: () => now,
  managerChatId: '777',
  maxAttempts,
});

async function enqueue(type: string, payload: OrderNotificationSnapshot) {
  return db.outboxMessage.create({
    data: { type, payload: payload as unknown as Prisma.InputJsonValue, availableAt: now },
  });
}

beforeEach(async () => {
  await db.$executeRawUnsafe('TRUNCATE "OutboxMessage" RESTART IDENTITY');
});

describe('outbox worker', () => {
  it('sends new orders to the manager and status changes to the customer', async () => {
    const tg = new FakeTelegram();
    await enqueue('order.created', snapshot('42'));
    await enqueue('order.status_changed', snapshot('42'));
    expect(await processOutboxBatch(workerDeps(tg))).toBe(2);
    expect(tg.sent.map((s) => s.chatId)).toEqual(['777', '42']);
    expect(await db.outboxMessage.count({ where: { status: 'SENT' } })).toBe(2);
    expect(await processOutboxBatch(workerDeps(tg))).toBe(0);
  });

  it('does not retry when the user blocked the bot (403)', async () => {
    const tg = new FakeTelegram();
    tg.failures.set('42', 403);
    const msg = await enqueue('order.status_changed', snapshot('42'));
    await processOutboxBatch(workerDeps(tg));
    const row = await db.outboxMessage.findUniqueOrThrow({ where: { id: msg.id } });
    expect(row.status).toBe('FAILED');
    expect(row.attempts).toBe(1);
  });

  it('retries temporary errors with backoff, then gives up', async () => {
    const tg = new FakeTelegram();
    tg.failures.set('42', 500);
    const msg = await enqueue('order.status_changed', snapshot('42'));
    await processOutboxBatch(workerDeps(tg));
    let row = await db.outboxMessage.findUniqueOrThrow({ where: { id: msg.id } });
    expect(row.status).toBe('PENDING');
    expect(row.availableAt.getTime()).toBe(now.getTime() + 5000);

    // Not available yet: nothing is processed.
    expect(await processOutboxBatch(workerDeps(tg))).toBe(0);

    await db.outboxMessage.update({
      where: { id: msg.id },
      data: { availableAt: now, attempts: 3 },
    });
    await processOutboxBatch(workerDeps(tg));
    row = await db.outboxMessage.findUniqueOrThrow({ where: { id: msg.id } });
    expect(row.status).toBe('FAILED');
  });

  it('two workers never send the same message twice', async () => {
    const tg = new FakeTelegram();
    for (let i = 0; i < 10; i++) await enqueue('order.created', snapshot('42'));
    await Promise.all([processOutboxBatch(workerDeps(tg)), processOutboxBatch(workerDeps(tg))]);
    expect(tg.sent).toHaveLength(10);
  });
});

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { createPrismaClient, type PrismaClient } from '@vapehard/db';
import { pino } from 'pino';

import { createApp } from '../src/app.js';
import type { Deps, Storage } from '../src/deps.js';
import { signInitData } from '../src/lib/init-data.js';

export const BOT_TOKEN = '123456:TEST_TOKEN';
export const ADMIN_TG_ID = 9000;
export const ADMIN_PASSWORD = 'correct-horse-battery';

const rootEnv = resolve(import.meta.dirname, '../../../.env');
if (!process.env.TEST_DATABASE_URL && existsSync(rootEnv)) process.loadEnvFile(rootEnv);

let shared: PrismaClient | undefined;
export function testDb(): PrismaClient {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL is required');
  shared ??= createPrismaClient(url);
  return shared;
}

export class FakeStorage implements Storage {
  readonly objects = new Set<string>();
  readonly removed: string[] = [];
  presignPost(key: string) {
    return Promise.resolve({ url: 'https://example.test/media/vapehard', fields: { key } });
  }
  exists(key: string) {
    return Promise.resolve(this.objects.has(key));
  }
  remove(key: string) {
    this.removed.push(key);
    this.objects.delete(key);
    return Promise.resolve();
  }
  ping() {
    return Promise.resolve();
  }
}

export interface TestContext {
  deps: Deps;
  app: ReturnType<typeof createApp>;
  storage: FakeStorage;
  now: { value: Date };
}

export function makeContext(overrides: Partial<Deps> = {}): TestContext {
  const now = { value: new Date('2026-10-10T12:00:00Z') };
  const storage = new FakeStorage();
  let seq = 0;
  const deps: Deps = {
    db: testDb(),
    storage,
    log: pino({ level: 'silent' }),
    clock: () => now.value,
    randomInt: (max) => seq++ % max,
    config: {
      botToken: BOT_TOKEN,
      adminTelegramIds: new Set([BigInt(ADMIN_TG_ID)]),
      adminPassword: ADMIN_PASSWORD,
      adminSessionHours: 12,
      managerUsername: 'VapeHard_manager',
      initDataMaxAgeSeconds: 3600,
      rewardTtlDays: 7,
      mediaBaseUrl: 'https://example.test/media/vapehard',
    },
    ...overrides,
  };
  return { deps, app: createApp(deps), storage, now };
}

export function authHeader(
  ctx: TestContext,
  tgId: number,
  username: string | null = `user${tgId}`,
) {
  const user = JSON.stringify({ id: tgId, first_name: 'Test', ...(username ? { username } : {}) });
  const authDate = String(Math.floor(ctx.now.value.getTime() / 1000) - 10);
  return { authorization: `tma ${signInitData({ auth_date: authDate, user }, BOT_TOKEN)}` };
}

export async function call(
  ctx: TestContext,
  method: string,
  path: string,
  opts: { tgId?: number; body?: unknown; headers?: Record<string, string> } = {},
) {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(opts.tgId === undefined ? {} : authHeader(ctx, opts.tgId)),
    ...opts.headers,
  };
  const res = await ctx.app.request(`/api/v1${path}`, {
    method,
    headers,
    ...(opts.body === undefined ? {} : { body: JSON.stringify(opts.body) }),
  });
  const text = await res.text();
  return {
    status: res.status,
    body: (text ? JSON.parse(text) : null) as Record<string, unknown> & {
      error?: { code: string };
    },
  };
}

/** Clears all tables and loads a small fixture. Returns ids. */
export async function resetDb() {
  const db = testDb();
  await db.$executeRawUnsafe(`
    TRUNCATE "AuditLog", "OutboxMessage", "StockMovement", "RouletteSpin", "OrderItem",
      "Order", "Reward", "RoulettePrize", "Variant", "Product", "Category", "User"
    RESTART IDENTITY CASCADE`);
  const category = await db.category.create({ data: { slug: 'liquids', title: 'Жидкости' } });
  const product = await db.product.create({
    data: {
      name: 'Husky',
      categoryId: category.id,
      priceMinor: 2800,
      variants: {
        create: [
          { name: 'Mint', stock: 5, sortOrder: 0 },
          { name: 'Last one', stock: 1, sortOrder: 1 },
        ],
      },
    },
    include: { variants: { orderBy: { sortOrder: 'asc' } } },
  });
  const prizes = [
    {
      key: '5BYN',
      title: 'Скидка 5 BYN',
      label: '5р',
      type: 'FIXED' as const,
      amount: 500,
      weight: 500_000,
    },
    {
      key: '10PCT',
      title: 'Скидка 10%',
      label: '10%',
      type: 'PERCENT' as const,
      amount: 10,
      weight: 499_999,
    },
    {
      key: 'GIFT',
      title: 'Картридж в подарок',
      label: '🎁',
      type: 'GIFT' as const,
      amount: 0,
      weight: 1,
    },
  ];
  for (const [i, p] of prizes.entries()) {
    await db.roulettePrize.create({ data: { ...p, color: '#000000', sortOrder: i } });
  }
  const [mint, last] = product.variants;
  if (!mint || !last) throw new Error('fixture broken');
  return { categoryId: category.id, productId: product.id, mintId: mint.id, lastId: last.id };
}

/** Creates a user that already passed the 18+ gate. */
export async function adultUser(tgId: number, role: 'CUSTOMER' | 'ADMIN' = 'CUSTOMER') {
  return testDb().user.create({
    data: {
      telegramId: BigInt(tgId),
      username: `user${tgId}`,
      firstName: 'Test',
      role,
      ageConfirmedAt: new Date('2026-01-01'),
    },
  });
}

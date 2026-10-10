import { autoRetry } from '@grammyjs/auto-retry';
import { apiThrottler } from '@grammyjs/transformer-throttler';
import type { PrismaClient } from '@vapehard/db';
import { Bot, InlineKeyboard, type Context } from 'grammy';
import type { Logger } from 'pino';

import { t } from './messages.ru.js';

export type BotContext = Context;

export interface BotDeps {
  db: PrismaClient;
  log: Logger;
  clock: () => Date;
  webAppUrl: string;
  managerUsername: string;
}

export const shopKeyboard = (webAppUrl: string) =>
  new InlineKeyboard().webApp(t.openShop, webAppUrl);

/** Handlers are plain functions so tests can call them with a fake context. */
export const handlers = {
  async start(ctx: Pick<Context, 'from' | 'reply'>, deps: BotDeps) {
    await ctx.reply(t.start(ctx.from?.first_name ?? ''), {
      parse_mode: 'HTML',
      reply_markup: shopKeyboard(deps.webAppUrl),
    });
  },

  async help(ctx: Pick<Context, 'reply'>, deps: BotDeps) {
    await ctx.reply(t.help(deps.managerUsername), { parse_mode: 'HTML' });
  },

  async orders(ctx: Pick<Context, 'from' | 'reply'>, deps: BotDeps) {
    if (!ctx.from) return;
    const orders = await deps.db.order.findMany({
      where: { user: { telegramId: BigInt(ctx.from.id) } },
      orderBy: { id: 'desc' },
      take: 5,
      select: { number: true, status: true, totalMinor: true, createdAt: true },
    });
    if (orders.length === 0) {
      await ctx.reply(t.noOrders, { reply_markup: shopKeyboard(deps.webAppUrl) });
      return;
    }
    await ctx.reply(t.ordersList(orders), { parse_mode: 'HTML' });
  },

  async stats(ctx: Pick<Context, 'from' | 'reply'>, deps: BotDeps) {
    if (!ctx.from) return;
    const user = await deps.db.user.findUnique({
      where: { telegramId: BigInt(ctx.from.id) },
      select: { role: true, adminUntil: true },
    });
    // Same rule as the API: permanent admin role or an active password session.
    const admin =
      user?.role === 'ADMIN' || (user?.adminUntil != null && user.adminUntil > deps.clock());
    if (!admin) {
      await ctx.reply(t.notAdmin);
      return;
    }
    const now = deps.clock();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const [count, completed] = await Promise.all([
      deps.db.order.count({ where: { createdAt: { gte: dayStart } } }),
      deps.db.order.aggregate({
        where: { createdAt: { gte: dayStart }, status: 'COMPLETED' },
        _sum: { totalMinor: true },
        _count: true,
      }),
    ]);
    await ctx.reply(t.stats(count, completed._sum.totalMinor ?? 0, completed._count), {
      parse_mode: 'HTML',
    });
  },
};

export function createBot(token: string, deps: BotDeps): Bot {
  const bot = new Bot<BotContext>(token);
  bot.api.config.use(apiThrottler());
  bot.api.config.use(autoRetry({ maxRetryAttempts: 3, maxDelaySeconds: 30 }));

  bot.command('start', (ctx) => handlers.start(ctx, deps));
  bot.command('help', (ctx) => handlers.help(ctx, deps));
  bot.command('orders', (ctx) => handlers.orders(ctx, deps));
  bot.command('stats', (ctx) => handlers.stats(ctx, deps));

  bot.catch(async (err) => {
    deps.log.error(
      { err: err.error, updateId: err.ctx.update.update_id, chatId: err.ctx.chat?.id },
      'bot handler failed',
    );
    try {
      await err.ctx.reply(t.error);
    } catch {
      // The chat may be unavailable; the error is already logged.
    }
  });
  return bot;
}

/** Commands list and the menu button that opens the Mini App. */
export async function configureBot(bot: Bot, webAppUrl: string): Promise<void> {
  await bot.api.setMyCommands([
    { command: 'start', description: 'Открыть магазин' },
    { command: 'orders', description: 'Мои заказы' },
    { command: 'help', description: 'Помощь' },
  ]);
  await bot.api.setChatMenuButton({
    menu_button: { type: 'web_app', text: t.menuButton, web_app: { url: webAppUrl } },
  });
}

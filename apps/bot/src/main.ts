import { run, type RunnerHandle } from '@grammyjs/runner';
import { serve } from '@hono/node-server';
import { createPrismaClient } from '@vapehard/db';
import { webhookCallback } from 'grammy';
import { Hono } from 'hono';
import { pino } from 'pino';

import { configureBot, createBot } from './bot.js';
import { loadEnv } from './env.js';
import { startOutboxWorker } from './outbox-worker.js';

const env = loadEnv();
const log = pino({
  level: env.LOG_LEVEL,
  redact: { paths: ['*.token', 'token'], censor: '[redacted]' },
  ...(env.NODE_ENV === 'development' ? { transport: { target: 'pino-pretty' } } : {}),
});
const db = createPrismaClient(env.DATABASE_URL);
const clock = () => new Date();

const bot = createBot(env.BOT_TOKEN, {
  db,
  log,
  clock,
  webAppUrl: env.WEB_APP_URL,
  managerUsername: env.MANAGER_USERNAME,
});

const stopWorker = startOutboxWorker(
  {
    db,
    log,
    clock,
    managerChatId: env.MANAGER_CHAT_ID,
    sender: {
      async sendMessage(chatId, text) {
        await bot.api.sendMessage(chatId, text, {
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true },
        });
      },
    },
  },
  env.OUTBOX_POLL_MS,
);

let runner: RunnerHandle | undefined;
let server: ReturnType<typeof serve> | undefined;

async function start(): Promise<void> {
  await bot.init();
  await configureBot(bot, env.WEB_APP_URL);

  // Health endpoint in both modes (Docker healthcheck); the webhook route only in webhook mode.
  const app = new Hono().get('/healthz', (c) => c.json({ ok: true }));
  if (env.BOT_MODE === 'webhook' && env.WEBHOOK_URL && env.WEBHOOK_SECRET) {
    // grammY checks X-Telegram-Bot-Api-Secret-Token against the secret.
    app.post(
      '/telegram/webhook',
      webhookCallback(bot, 'hono', { secretToken: env.WEBHOOK_SECRET }),
    );
    server = serve({ fetch: app.fetch, port: env.BOT_PORT });
    await bot.api.setWebhook(env.WEBHOOK_URL, {
      secret_token: env.WEBHOOK_SECRET,
      allowed_updates: ['message', 'callback_query'],
    });
    log.info({ port: env.BOT_PORT }, 'bot started in webhook mode');
  } else {
    server = serve({ fetch: app.fetch, port: env.BOT_PORT });
    await bot.api.deleteWebhook();
    runner = run(bot);
    log.info('bot started in polling mode');
  }
}

async function shutdown(signal: string): Promise<void> {
  log.info({ signal }, 'bot shutting down');
  const force = setTimeout(() => process.exit(1), 10_000);
  force.unref();
  await Promise.allSettled([
    runner?.isRunning() ? runner.stop() : Promise.resolve(),
    stopWorker(),
    new Promise<void>((resolve) => {
      if (server)
        server.close(() => {
          resolve();
        });
      else resolve();
    }),
  ]);
  await db.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
process.on('unhandledRejection', (reason) => {
  log.error({ err: reason }, 'unhandled rejection');
});

start().catch((error: unknown) => {
  log.fatal({ err: error }, 'bot failed to start');
  process.exit(1);
});

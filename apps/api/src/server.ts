import { randomInt } from 'node:crypto';

import { serve } from '@hono/node-server';
import { createPrismaClient } from '@vapehard/db';

import { createApp } from './app.js';
import { loadEnv } from './env.js';
import { createS3Storage } from './lib/storage.js';
import { createLogger } from './logger.js';

const env = loadEnv();
const log = createLogger(env.LOG_LEVEL, env.NODE_ENV === 'development');
const db = createPrismaClient(env.DATABASE_URL);

const app = createApp({
  db,
  log,
  clock: () => new Date(),
  randomInt: (max) => randomInt(max),
  storage: createS3Storage({
    endpoint: env.S3_ENDPOINT,
    publicEndpoint: env.S3_PUBLIC_ENDPOINT,
    bucket: env.S3_BUCKET,
    region: env.S3_REGION,
    accessKey: env.S3_ACCESS_KEY,
    secretKey: env.S3_SECRET_KEY,
  }),
  config: {
    botToken: env.BOT_TOKEN,
    adminTelegramIds: env.ADMIN_TELEGRAM_IDS,
    adminPassword: env.ADMIN_PASSWORD,
    adminSessionHours: env.ADMIN_SESSION_HOURS,
    managerUsername: env.MANAGER_USERNAME,
    initDataMaxAgeSeconds: env.INIT_DATA_MAX_AGE_SECONDS,
    rewardTtlDays: env.REWARD_TTL_DAYS,
    mediaBaseUrl: env.MEDIA_BASE_URL,
  },
});

const server = serve({ fetch: app.fetch, port: env.API_PORT }, (info) => {
  log.info({ port: info.port }, 'API listening');
});

// Graceful shutdown: stop accepting connections, finish in-flight requests, close the DB.
function shutdown(signal: string): void {
  log.info({ signal }, 'shutting down');
  const force = setTimeout(() => process.exit(1), 10_000);
  force.unref();
  server.close(() => {
    void db.$disconnect().finally(() => process.exit(0));
  });
}
process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  shutdown('SIGINT');
});
process.on('unhandledRejection', (reason) => {
  log.error({ err: reason }, 'unhandled rejection');
});

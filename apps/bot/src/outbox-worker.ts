import type { OutboxMessage, PrismaClient } from '@vapehard/db';
import type { OrderNotificationSnapshot, OutboxEventType } from '@vapehard/shared';
import type { Logger } from 'pino';

import { t } from './messages.ru.js';

/** Minimal Telegram port, so tests can pass a fake. */
export interface Sender {
  sendMessage(chatId: string, text: string): Promise<void>;
}

/** Error from Telegram with an HTTP-like code (grammY GrammyError has `error_code`). */
export interface TelegramErrorLike {
  error_code?: number;
  description?: string;
}

export interface WorkerDeps {
  db: PrismaClient;
  sender: Sender;
  log: Logger;
  clock: () => Date;
  managerChatId: string;
  maxAttempts?: number;
  batchSize?: number;
}

const LOCK_TIMEOUT_MS = 5 * 60 * 1000;
const BASE_BACKOFF_MS = 5_000;

export function backoffMs(attempts: number): number {
  return Math.min(BASE_BACKOFF_MS * 2 ** (attempts - 1), 60 * 60 * 1000);
}

function render(msg: OutboxMessage, managerChatId: string): { chatId: string; text: string } {
  const payload = msg.payload as unknown as OrderNotificationSnapshot;
  switch (msg.type as OutboxEventType) {
    case 'order.created':
      return { chatId: managerChatId, text: t.managerNewOrder(payload) };
    case 'order.status_changed':
      return { chatId: payload.customer.telegramId, text: t.customerStatusChanged(payload) };
    default:
      throw new Error(`Unknown outbox type: ${msg.type}`);
  }
}

/**
 * Claims a batch with FOR UPDATE SKIP LOCKED (safe with several workers),
 * marks it locked, then sends outside the transaction.
 */
async function claim(deps: WorkerDeps, now: Date): Promise<OutboxMessage[]> {
  const staleLock = new Date(now.getTime() - LOCK_TIMEOUT_MS);
  return deps.db.$queryRaw<OutboxMessage[]>`
    UPDATE "OutboxMessage" SET "lockedAt" = ${now}, "attempts" = "attempts" + 1
    WHERE id IN (
      SELECT id FROM "OutboxMessage"
      WHERE status = 'PENDING' AND "availableAt" <= ${now}
        AND ("lockedAt" IS NULL OR "lockedAt" < ${staleLock})
      ORDER BY id
      LIMIT ${deps.batchSize ?? 20}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *`;
}

/** Processes one batch. Returns how many messages were handled. */
export async function processOutboxBatch(deps: WorkerDeps): Promise<number> {
  const now = deps.clock();
  const maxAttempts = deps.maxAttempts ?? 8;
  const batch = await claim(deps, now);

  for (const msg of batch) {
    try {
      const { chatId, text } = render(msg, deps.managerChatId);
      await deps.sender.sendMessage(chatId, text);
      await deps.db.outboxMessage.update({
        where: { id: msg.id },
        data: { status: 'SENT', sentAt: deps.clock(), lockedAt: null, lastError: null },
      });
    } catch (error) {
      const code = (error as TelegramErrorLike).error_code;
      const message = error instanceof Error ? error.message : String(error);
      // 403: the user blocked the bot. Retrying will not help.
      const permanent = code === 403 || code === 400 || msg.attempts >= maxAttempts;
      deps.log.warn({ outboxId: msg.id, type: msg.type, code, permanent }, 'outbox send failed');
      await deps.db.outboxMessage.update({
        where: { id: msg.id },
        data: permanent
          ? { status: 'FAILED', lockedAt: null, lastError: message.slice(0, 500) }
          : {
              lockedAt: null,
              lastError: message.slice(0, 500),
              availableAt: new Date(now.getTime() + backoffMs(msg.attempts)),
            },
      });
    }
  }
  return batch.length;
}

/** Polls until stopped. A full batch is followed immediately by the next one. */
export function startOutboxWorker(deps: WorkerDeps, pollMs: number): () => Promise<void> {
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  let running: Promise<void> = Promise.resolve();

  const schedule = (delay: number) => {
    if (stopped) return;
    timer = setTimeout(() => {
      running = tick();
    }, delay);
  };
  async function tick(): Promise<void> {
    try {
      const handled = await processOutboxBatch(deps);
      schedule(handled > 0 ? 0 : pollMs);
    } catch (error) {
      deps.log.error({ err: error }, 'outbox worker tick failed');
      schedule(pollMs);
    }
  }
  running = tick();

  return async () => {
    stopped = true;
    clearTimeout(timer);
    await running;
  };
}

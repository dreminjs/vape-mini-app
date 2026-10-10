import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    DATABASE_URL: z.url(),
    BOT_TOKEN: z.string().regex(/^\d+:[\w-]+$/, 'looks invalid'),
    BOT_MODE: z.enum(['webhook', 'polling']).default('polling'),
    BOT_PORT: z.coerce.number().int().positive().default(3001),
    WEBHOOK_URL: z.url().optional(),
    WEBHOOK_SECRET: z
      .string()
      .regex(/^[A-Za-z0-9_-]{16,256}$/, '16-256 chars: A-Z a-z 0-9 _ -')
      .optional(),
    WEB_APP_URL: z.url(),
    MANAGER_CHAT_ID: z.string().regex(/^-?\d+$/),
    MANAGER_USERNAME: z.string().regex(/^[A-Za-z0-9_]{5,32}$/),
    OUTBOX_POLL_MS: z.coerce.number().int().positive().default(2000),
  })
  .refine((e) => e.BOT_MODE === 'polling' || (e.WEBHOOK_URL && e.WEBHOOK_SECRET), {
    message: 'WEBHOOK_URL and WEBHOOK_SECRET are required when BOT_MODE=webhook',
    path: ['BOT_MODE'],
  });

export type BotEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): BotEnv {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment:\n${problems}`);
  }
  return result.data;
}

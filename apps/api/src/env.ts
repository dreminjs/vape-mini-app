import { z } from 'zod';

const idList = z
  .string()
  .default('')
  .transform((v) =>
    v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.string().regex(/^\d+$/, 'must be numeric Telegram IDs')))
  .transform((ids) => new Set(ids.map((id) => BigInt(id))));

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.url(),
  BOT_TOKEN: z.string().regex(/^\d+:[\w-]+$/, 'looks invalid'),
  ADMIN_TELEGRAM_IDS: idList,
  /** Password for the admin panel. Anyone who knows it gets admin access for ADMIN_SESSION_HOURS. */
  ADMIN_PASSWORD: z.string().min(10, 'must be at least 10 characters'),
  ADMIN_SESSION_HOURS: z.coerce.number().int().positive().default(12),
  MANAGER_USERNAME: z.string().regex(/^[A-Za-z0-9_]{5,32}$/),
  INIT_DATA_MAX_AGE_SECONDS: z.coerce.number().int().positive().default(3600),
  REWARD_TTL_DAYS: z.coerce.number().int().positive().default(7),
  S3_ENDPOINT: z.url(),
  S3_PUBLIC_ENDPOINT: z.url(),
  S3_BUCKET: z.string().min(3),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  MEDIA_BASE_URL: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

/** Fails fast with a readable list of problems. Values are never printed. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment:\n${problems}`);
  }
  return result.data;
}

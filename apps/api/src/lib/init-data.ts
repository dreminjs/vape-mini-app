import { createHmac, timingSafeEqual } from 'node:crypto';

import { z } from 'zod';

export const telegramUserSchema = z.object({
  id: z.number().int().positive(),
  first_name: z.string().default(''),
  last_name: z.string().optional(),
  username: z.string().optional(),
});
export type TelegramUser = z.infer<typeof telegramUserSchema>;

export type InitDataResult =
  | { ok: true; user: TelegramUser; authDate: Date }
  | { ok: false; reason: 'MISSING_HASH' | 'BAD_HASH' | 'EXPIRED' | 'BAD_USER' };

/**
 * Validates Telegram Mini App initData:
 * secret = HMAC_SHA256(key="WebAppData", botToken);
 * hash = hex(HMAC_SHA256(key=secret, data_check_string)),
 * where data_check_string = sorted "key=value" pairs (without hash) joined by "\n".
 */
export function validateInitData(
  raw: string,
  botToken: string,
  maxAgeSeconds: number,
  now: Date,
): InitDataResult {
  const params = new URLSearchParams(raw);
  const hash = params.get('hash');
  if (!hash) return { ok: false, reason: 'MISSING_HASH' };
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(dataCheckString).digest();
  const given = Buffer.from(hash, 'hex');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, reason: 'BAD_HASH' };
  }

  const authDateSec = Number(params.get('auth_date'));
  if (!Number.isFinite(authDateSec) || now.getTime() / 1000 - authDateSec > maxAgeSeconds) {
    return { ok: false, reason: 'EXPIRED' };
  }

  try {
    const user = telegramUserSchema.parse(JSON.parse(params.get('user') ?? 'null'));
    return { ok: true, user, authDate: new Date(authDateSec * 1000) };
  } catch {
    return { ok: false, reason: 'BAD_USER' };
  }
}

/** Builds a signed initData string. Used by tests and the dev mock. */
export function signInitData(fields: Record<string, string>, botToken: string): string {
  const params = new URLSearchParams(fields);
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  params.set('hash', createHmac('sha256', secret).update(dataCheckString).digest('hex'));
  return params.toString();
}

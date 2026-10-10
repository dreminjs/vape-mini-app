import { z } from 'zod';

import { ERROR_CODES } from '../constants.js';

export const idSchema = z.coerce.number().int().positive();
export const idParamSchema = z.object({ id: idSchema });

export const cursorQuerySchema = z.object({
  cursor: idSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const moneyMinorSchema = z.int().min(0).max(100_000_000);

/** Telegram username rules: 5–32 chars, letters, digits, underscore. Leading @ is removed. */
export const telegramUsernameSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/^@/, ''))
  .pipe(z.string().regex(/^[A-Za-z0-9_]{5,32}$/, 'Некорректный username'));

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiErrorBody = z.infer<typeof apiErrorSchema>;

export interface Page<T> {
  items: T[];
  nextCursor: number | null;
}

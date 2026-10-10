import { createMiddleware } from 'hono/factory';

import type { AppEnv } from '../deps.js';
import { AppError, forbidden, unauthorized } from '../errors.js';
import { validateInitData } from '../lib/init-data.js';
import { isAdmin, upsertTelegramUser } from '../services/users.js';

/** Header format: `Authorization: tma <initDataRaw>`. */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const deps = c.get('deps');
  const header = c.req.header('authorization') ?? '';
  const [scheme, raw] = header.split(' ', 2);
  if (scheme !== 'tma' || !raw) throw unauthorized();

  const result = validateInitData(
    raw,
    deps.config.botToken,
    deps.config.initDataMaxAgeSeconds,
    deps.clock(),
  );
  if (!result.ok) {
    deps.log.info({ reason: result.reason }, 'initData rejected');
    throw unauthorized(
      result.reason === 'EXPIRED' ? 'Сессия устарела, откройте приложение заново' : undefined,
    );
  }

  c.set('user', await upsertTelegramUser(deps, result.user));
  await next();
});

export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  if (!isAdmin(c.get('user'), c.get('deps').clock())) throw forbidden();
  await next();
});

export const requireAge = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get('user').ageConfirmedAt) {
    throw new AppError(403, 'AGE_NOT_CONFIRMED', 'Подтвердите, что вам есть 18 лет');
  }
  await next();
});

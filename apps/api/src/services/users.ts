import { createHash, timingSafeEqual } from 'node:crypto';

import type { MeDto } from '@vapehard/shared';

import type { AuthUser, Deps } from '../deps.js';
import { forbidden } from '../errors.js';
import type { TelegramUser } from '../lib/init-data.js';

/**
 * Creates or refreshes the user from verified initData.
 * IDs in ADMIN_TELEGRAM_IDS are promoted; other roles are left as stored (see ASSUMPTIONS #11).
 */
export async function upsertTelegramUser(deps: Deps, tg: TelegramUser): Promise<AuthUser> {
  const telegramId = BigInt(tg.id);
  const isEnvAdmin = deps.config.adminTelegramIds.has(telegramId);
  const profile = {
    username: tg.username ?? null,
    firstName: tg.first_name,
    lastName: tg.last_name ?? null,
    lastSeenAt: deps.clock(),
  };
  return deps.db.user.upsert({
    where: { telegramId },
    create: { telegramId, ...profile, role: isEnvAdmin ? 'ADMIN' : 'CUSTOMER' },
    update: { ...profile, ...(isEnvAdmin ? { role: 'ADMIN' as const } : {}) },
  });
}

export async function confirmAge(deps: Deps, user: AuthUser): Promise<AuthUser> {
  if (user.ageConfirmedAt) return user;
  return deps.db.user.update({ where: { id: user.id }, data: { ageConfirmedAt: deps.clock() } });
}

/** Admin = permanent role (ADMIN_TELEGRAM_IDS) or a password session that has not expired. */
export function isAdmin(user: AuthUser, now: Date): boolean {
  return user.role === 'ADMIN' || (user.adminUntil !== null && user.adminUntil > now);
}

/** Hashing both sides gives equal lengths, so the comparison is constant-time. */
function passwordMatches(given: string, expected: string): boolean {
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function adminLogin(deps: Deps, user: AuthUser, password: string): Promise<AuthUser> {
  if (!passwordMatches(password, deps.config.adminPassword)) {
    deps.log.warn({ userId: user.id }, 'admin login failed');
    throw forbidden('Неверный пароль');
  }
  const until = new Date(deps.clock().getTime() + deps.config.adminSessionHours * 3600_000);
  deps.log.info({ userId: user.id }, 'admin login');
  return deps.db.user.update({ where: { id: user.id }, data: { adminUntil: until } });
}

export async function adminLogout(deps: Deps, user: AuthUser): Promise<AuthUser> {
  return deps.db.user.update({ where: { id: user.id }, data: { adminUntil: null } });
}

export function toMeDto(user: AuthUser, now: Date): MeDto {
  return {
    id: user.id,
    telegramId: user.telegramId.toString(),
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    isAdmin: isAdmin(user, now),
    ageConfirmed: user.ageConfirmedAt !== null,
  };
}

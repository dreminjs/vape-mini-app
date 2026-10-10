import type { MeDto } from '@vapehard/shared';

import type { AuthUser, Deps } from '../deps.js';
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

export function toMeDto(user: AuthUser): MeDto {
  return {
    id: user.id,
    telegramId: user.telegramId.toString(),
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    isAdmin: user.role === 'ADMIN',
    ageConfirmed: user.ageConfirmedAt !== null,
  };
}

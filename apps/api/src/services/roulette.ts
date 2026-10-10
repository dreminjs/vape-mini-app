import {
  generateRewardCode,
  pickWeightedIndex,
  ROULETTE_COOLDOWN_MS,
  type PrizePublicDto,
  type RouletteStateDto,
  type SpinResultDto,
} from '@vapehard/shared';

import type { AuthUser, Deps } from '../deps.js';
import { conflict } from '../errors.js';

import { toRewardDto } from './mappers.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function toPrizePublic(p: {
  key: string;
  label: string;
  title: string;
  color: string;
  type: PrizePublicDto['type'];
}): PrizePublicDto {
  return { key: p.key, label: p.label, title: p.title, color: p.color, type: p.type };
}

async function activePrizes(deps: Deps) {
  return deps.db.roulettePrize.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
}

export async function getRouletteState(deps: Deps, user: AuthUser): Promise<RouletteStateDto> {
  const now = deps.clock();
  const [prizes, lastSpin, rewards] = await Promise.all([
    activePrizes(deps),
    deps.db.rouletteSpin.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } }),
    deps.db.reward.findMany({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: now } },
      include: { prize: { select: { title: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  const next = lastSpin ? new Date(lastSpin.createdAt.getTime() + ROULETTE_COOLDOWN_MS) : null;
  return {
    prizes: prizes.map(toPrizePublic),
    nextSpinAt: next && next > now ? next.toISOString() : null,
    serverTime: now.toISOString(),
    rewards: rewards.map(toRewardDto),
  };
}

/**
 * One spin per 24h. The user row is locked (SELECT ... FOR UPDATE), so two parallel
 * requests are serialized and the second one sees the first spin.
 */
export async function spin(deps: Deps, user: AuthUser): Promise<SpinResultDto> {
  const now = deps.clock();
  return deps.db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`;

    const last = await tx.rouletteSpin.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    if (last) {
      const nextAt = new Date(last.createdAt.getTime() + ROULETTE_COOLDOWN_MS);
      if (nextAt > now) {
        throw conflict('ROULETTE_COOLDOWN', 'Следующий прокрут ещё недоступен', {
          nextSpinAt: nextAt.toISOString(),
        });
      }
    }

    const prizes = await tx.roulettePrize.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    const prizeIndex = pickWeightedIndex(
      prizes.map((p) => p.weight),
      deps.randomInt,
    );
    const prize = prizes[prizeIndex];
    if (!prize) throw new Error('No active roulette prizes');

    let code = generateRewardCode(prize.key, deps.randomInt);
    // Rare collision: try a few more codes before giving up.
    for (
      let attempt = 0;
      attempt < 5 && (await tx.reward.findUnique({ where: { code } }));
      attempt++
    ) {
      code = generateRewardCode(prize.key, deps.randomInt, 6);
    }

    const reward = await tx.reward.create({
      data: {
        code,
        userId: user.id,
        prizeId: prize.id,
        type: prize.type,
        amount: prize.amount,
        giftName: prize.type === 'GIFT' ? prize.title : null,
        expiresAt: new Date(now.getTime() + deps.config.rewardTtlDays * DAY_MS),
        createdAt: now,
      },
      include: { prize: { select: { title: true } } },
    });
    await tx.rouletteSpin.create({
      data: { userId: user.id, prizeId: prize.id, rewardId: reward.id, createdAt: now },
    });

    return {
      prize: toPrizePublic(prize),
      prizeIndex,
      reward: toRewardDto(reward),
      nextSpinAt: new Date(now.getTime() + ROULETTE_COOLDOWN_MS).toISOString(),
      serverTime: now.toISOString(),
    };
  });
}

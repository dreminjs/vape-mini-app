import type { Prisma, PrismaClient, Reward } from '@vapehard/db';

import { AppError } from '../errors.js';

type Db = PrismaClient | Prisma.TransactionClient;

export type RewardCheck =
  { ok: true; reward: Reward & { prize: { title: string } } } | { ok: false; message: string };

/** Personal, single-use, not expired. Does not consume. */
export async function checkReward(
  db: Db,
  code: string,
  userId: number,
  now: Date,
): Promise<RewardCheck> {
  const reward = await db.reward.findUnique({
    where: { code },
    include: { prize: { select: { title: true } } },
  });
  if (!reward || reward.userId !== userId) return { ok: false, message: 'Промокод не найден' };
  if (reward.usedAt) return { ok: false, message: 'Промокод уже использован' };
  if (reward.expiresAt <= now) return { ok: false, message: 'Срок действия промокода истёк' };
  return { ok: true, reward };
}

/** Consumes the reward atomically: a parallel order with the same code gets 0 rows. */
export async function consumeReward(
  tx: Prisma.TransactionClient,
  code: string,
  userId: number,
  now: Date,
): Promise<Reward & { prize: { title: string } }> {
  const check = await checkReward(tx, code, userId, now);
  if (!check.ok) throw new AppError(409, 'REWARD_INVALID', check.message);
  const { count } = await tx.reward.updateMany({
    where: { id: check.reward.id, usedAt: null },
    data: { usedAt: now },
  });
  if (count !== 1) throw new AppError(409, 'REWARD_INVALID', 'Промокод уже использован');
  return check.reward;
}

import { randomUUID } from 'node:crypto';

import type { Prisma } from '@vapehard/db';
import {
  MAX_IMAGE_BYTES,
  ORDER_STATUSES,
  ROULETTE_WEIGHT_TOTAL,
  type AdminOrderDto,
  type AdminOrdersQuery,
  type AdminPrizeDto,
  type AnalyticsSummaryDto,
  type OrderStatus,
  type Page,
  type PresignDto,
} from '@vapehard/shared';

import type { Deps } from '../deps.js';

import { orderWithItems, toOrderDto } from './mappers.js';

export async function listAdminOrders(
  deps: Deps,
  query: AdminOrdersQuery,
): Promise<Page<AdminOrderDto>> {
  const q = query.q?.replace(/^@/, '');
  const number = q ? Number(q.replace(/^VH-/i, '')) : NaN;
  const where: Prisma.OrderWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.from || query.to
      ? {
          createdAt: {
            ...(query.from ? { gte: new Date(query.from) } : {}),
            ...(query.to ? { lte: new Date(query.to) } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            ...(Number.isInteger(number) ? [{ number }] : []),
            { contactUsername: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
    ...(query.cursor ? { id: { lt: query.cursor } } : {}),
  };
  const rows = await deps.db.order.findMany({
    where,
    include: {
      ...orderWithItems,
      user: { select: { telegramId: true, username: true, firstName: true } },
    },
    orderBy: { id: 'desc' },
    take: query.limit + 1,
  });
  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;
  return {
    items: page.map((o) => ({
      ...toOrderDto(o),
      customer: {
        telegramId: o.user.telegramId.toString(),
        username: o.user.username,
        firstName: o.user.firstName,
      },
    })),
    nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
  };
}

export async function analyticsSummary(
  deps: Deps,
  range: { from?: string | undefined; to?: string | undefined },
): Promise<AnalyticsSummaryDto> {
  const createdAt = {
    ...(range.from ? { gte: new Date(range.from) } : {}),
    ...(range.to ? { lte: new Date(range.to) } : {}),
  };
  const [revenue, groups, stock] = await Promise.all([
    deps.db.order.aggregate({
      where: { status: 'COMPLETED', createdAt },
      _sum: { totalMinor: true },
      _count: true,
    }),
    deps.db.order.groupBy({ by: ['status'], where: { createdAt }, _count: { _all: true } }),
    deps.db.variant.aggregate({
      where: { product: { archivedAt: null } },
      _sum: { stock: true },
    }),
  ]);
  const countsByStatus = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0])) as Record<
    OrderStatus,
    number
  >;
  for (const g of groups) countsByStatus[g.status] = g._count._all;
  return {
    revenueMinor: revenue._sum.totalMinor ?? 0,
    completedCount: revenue._count,
    totalStock: stock._sum.stock ?? 0,
    ordersCount: groups.reduce((s, g) => s + g._count._all, 0),
    countsByStatus,
  };
}

export async function listPrizesWithOdds(deps: Deps): Promise<AdminPrizeDto[]> {
  const prizes = await deps.db.roulettePrize.findMany({ orderBy: { sortOrder: 'asc' } });
  return prizes.map((p) => ({
    key: p.key,
    title: p.title,
    label: p.label,
    type: p.type,
    amount: p.amount,
    weight: p.weight,
    probability: p.isActive ? p.weight / ROULETTE_WEIGHT_TOTAL : 0,
    color: p.color,
    isActive: p.isActive,
  }));
}

const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

export async function presignUpload(deps: Deps, contentType: string): Promise<PresignDto> {
  const key = `products/${randomUUID()}.${EXT[contentType] ?? 'bin'}`;
  const post = await deps.storage.presignPost(key, contentType, MAX_IMAGE_BYTES);
  return { ...post, key };
}

import { Prisma } from '@vapehard/db';
import {
  calcTotals,
  canTransition,
  getDeliveryOption,
  type CreateOrderInput,
  type OrderDto,
  type OrderStatus,
  type OutboxEvent,
  type Page,
} from '@vapehard/shared';

import type { AuthUser, Deps } from '../deps.js';
import { badRequest, conflict, notFound } from '../errors.js';

import { orderWithItems, toOrderDto, toOrderSnapshot } from './mappers.js';
import { consumeReward } from './rewards.js';

export interface OutOfStockItem {
  variantId: number;
  reason: 'NOT_AVAILABLE' | 'NOT_ENOUGH_STOCK';
  available: number;
}

export function writeOutbox(tx: Prisma.TransactionClient, event: OutboxEvent) {
  return tx.outboxMessage.create({
    data: { type: event.type, payload: event.payload as unknown as Prisma.InputJsonValue },
  });
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

async function findByIdempotencyKey(deps: Deps, userId: number, key: string) {
  return deps.db.order.findUnique({
    where: { userId_idempotencyKey: { userId, idempotencyKey: key } },
    include: orderWithItems,
  });
}

/**
 * Checkout in one transaction. Prices come from the DB only.
 * Stock is reduced with a conditional UPDATE (stock >= qty), so parallel orders cannot oversell.
 */
export async function createOrder(
  deps: Deps,
  user: AuthUser,
  input: CreateOrderInput,
  idempotencyKey: string,
): Promise<{ order: OrderDto; created: boolean }> {
  const existing = await findByIdempotencyKey(deps, user.id, idempotencyKey);
  if (existing) return { order: toOrderDto(existing), created: false };

  const contactUsername = user.username ?? input.contactUsername;
  if (!contactUsername) throw badRequest('Укажите Telegram username для связи');

  const now = deps.clock();
  // Sorted ids give a stable lock order and prevent deadlocks between parallel orders.
  const items = [...input.items].sort((a, b) => a.variantId - b.variantId);

  try {
    const order = await deps.db.$transaction(async (tx) => {
      const variants = await tx.variant.findMany({
        where: { id: { in: items.map((i) => i.variantId) } },
        include: {
          product: { select: { name: true, priceMinor: true, isActive: true, archivedAt: true } },
        },
      });
      const byId = new Map(variants.map((v) => [v.id, v]));

      const failing: OutOfStockItem[] = [];
      for (const item of items) {
        const v = byId.get(item.variantId);
        if (!v || !v.product.isActive || v.product.archivedAt) {
          failing.push({ variantId: item.variantId, reason: 'NOT_AVAILABLE', available: 0 });
          continue;
        }
        const { count } = await tx.variant.updateMany({
          where: { id: item.variantId, stock: { gte: item.qty } },
          data: { stock: { decrement: item.qty } },
        });
        if (count === 0) {
          const fresh = await tx.variant.findUnique({
            where: { id: item.variantId },
            select: { stock: true },
          });
          failing.push({
            variantId: item.variantId,
            reason: 'NOT_ENOUGH_STOCK',
            available: fresh?.stock ?? 0,
          });
        }
      }
      if (failing.length > 0) {
        throw conflict('OUT_OF_STOCK', 'Некоторых товаров не хватает на складе', {
          items: failing,
        });
      }

      const reward = input.rewardCode
        ? await consumeReward(tx, input.rewardCode, user.id, now)
        : null;

      const lines = items.map((item) => {
        // Every id was checked above, so the variant exists here.
        const v = byId.get(item.variantId);
        if (!v) throw new Error('unreachable: variant vanished');
        return { variant: v, qty: item.qty, unitPriceMinor: v.product.priceMinor };
      });
      const delivery = getDeliveryOption(input.deliveryMethod);
      const totals = calcTotals(lines, delivery.costMinor, reward);

      const created = await tx.order.create({
        data: {
          userId: user.id,
          deliveryMethod: input.deliveryMethod,
          ...totals,
          contactUsername,
          rewardId: reward?.id ?? null,
          giftName: reward?.type === 'GIFT' ? (reward.giftName ?? reward.prize.title) : null,
          idempotencyKey,
          createdAt: now,
          items: {
            create: lines.map((l) => ({
              variantId: l.variant.id,
              productName: l.variant.product.name,
              variantName: l.variant.name,
              unitPriceMinor: l.unitPriceMinor,
              qty: l.qty,
            })),
          },
        },
        include: orderWithItems,
      });

      await tx.stockMovement.createMany({
        data: lines.map((l) => ({
          variantId: l.variant.id,
          delta: -l.qty,
          reason: 'ORDER' as const,
          orderId: created.id,
        })),
      });
      await writeOutbox(tx, { type: 'order.created', payload: toOrderSnapshot(created, user) });
      return created;
    });
    return { order: toOrderDto(order), created: true };
  } catch (error) {
    // Same key sent twice in parallel: the loser hits the unique index and returns the winner's order.
    if (isUniqueViolation(error)) {
      const winner = await findByIdempotencyKey(deps, user.id, idempotencyKey);
      if (winner) return { order: toOrderDto(winner), created: false };
    }
    throw error;
  }
}

export async function listOwnOrders(
  deps: Deps,
  userId: number,
  cursor: number | undefined,
  limit: number,
): Promise<Page<OrderDto>> {
  const rows = await deps.db.order.findMany({
    where: { userId, ...(cursor ? { id: { lt: cursor } } : {}) },
    include: orderWithItems,
    orderBy: { id: 'desc' },
    take: limit + 1,
  });
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return { items: page.map(toOrderDto), nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null };
}

export async function getOwnOrder(deps: Deps, userId: number, id: number): Promise<OrderDto> {
  const order = await deps.db.order.findFirst({ where: { id, userId }, include: orderWithItems });
  if (!order) throw notFound('Заказ не найден');
  return toOrderDto(order);
}

/**
 * Admin status change. Guarded by the status machine and a conditional update on the old status.
 * Cancel restores stock and frees a non-expired reward.
 */
export async function changeOrderStatus(
  deps: Deps,
  admin: AuthUser,
  orderId: number,
  to: OrderStatus,
): Promise<OrderDto> {
  const now = deps.clock();
  const updated = await deps.db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { ...orderWithItems, reward: true, user: true },
    });
    if (!order) throw notFound('Заказ не найден');
    if (!canTransition(order.status, to)) {
      throw conflict('INVALID_STATUS_TRANSITION', 'Недопустимая смена статуса', {
        from: order.status,
        to,
      });
    }

    const freeReward = to === 'CANCELLED' && order.reward !== null && order.reward.expiresAt > now;
    const { count } = await tx.order.updateMany({
      where: { id: orderId, status: order.status },
      // Unlink the freed reward so it can be attached to a new order (rewardId is unique).
      data: { status: to, ...(freeReward ? { rewardId: null } : {}) },
    });
    if (count === 0) throw conflict('CONFLICT', 'Заказ уже изменён, обновите страницу');

    if (to === 'CANCELLED') {
      for (const item of order.items) {
        if (item.variantId === null) continue;
        await tx.variant.update({
          where: { id: item.variantId },
          data: { stock: { increment: item.qty } },
        });
        await tx.stockMovement.create({
          data: {
            variantId: item.variantId,
            delta: item.qty,
            reason: 'CANCEL',
            orderId,
            adminUserId: admin.id,
          },
        });
      }
      if (freeReward && order.reward) {
        await tx.reward.update({ where: { id: order.reward.id }, data: { usedAt: null } });
      }
    }

    const fresh = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: orderWithItems,
    });
    await writeOutbox(tx, {
      type: 'order.status_changed',
      payload: toOrderSnapshot(fresh, order.user),
    });
    await tx.auditLog.create({
      data: {
        adminUserId: admin.id,
        action: 'order.status',
        entity: 'Order',
        entityId: String(orderId),
        before: { status: order.status },
        after: { status: to },
      },
    });
    return fresh;
  });
  return toOrderDto(updated);
}

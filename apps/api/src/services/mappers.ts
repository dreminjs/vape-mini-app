import type { Prisma } from '@vapehard/db';
import {
  formatOrderNumber,
  type OrderDto,
  type OrderNotificationSnapshot,
  type ProductDto,
  type ProductListItemDto,
  type RewardDto,
} from '@vapehard/shared';

export function imageUrl(mediaBaseUrl: string, key: string | null): string | null {
  return key ? `${mediaBaseUrl.replace(/\/$/, '')}/${key}` : null;
}

export const productWithVariants = {
  category: { select: { slug: true, title: true } },
  variants: { select: { id: true, name: true, stock: true }, orderBy: { sortOrder: 'asc' } },
} satisfies Prisma.ProductInclude;

type ProductRow = Prisma.ProductGetPayload<{ include: typeof productWithVariants }>;

export function toProductListItem(p: ProductRow, mediaBaseUrl: string): ProductListItemDto {
  return {
    id: p.id,
    name: p.name,
    categorySlug: p.category.slug,
    categoryTitle: p.category.title,
    priceMinor: p.priceMinor,
    oldPriceMinor: p.oldPriceMinor,
    imageUrl: imageUrl(mediaBaseUrl, p.imageKey),
    variantCount: p.variants.length,
    totalStock: p.variants.reduce((sum, v) => sum + v.stock, 0),
  };
}

export function toProductDto(p: ProductRow, mediaBaseUrl: string): ProductDto {
  return {
    ...toProductListItem(p, mediaBaseUrl),
    description: p.description,
    variants: p.variants,
  };
}

export const orderWithItems = {
  items: { orderBy: { id: 'asc' } },
  reward: { select: { code: true } },
} satisfies Prisma.OrderInclude;

type OrderRow = Prisma.OrderGetPayload<{ include: typeof orderWithItems }>;

export function toOrderDto(o: OrderRow): OrderDto {
  return {
    id: o.id,
    number: o.number,
    displayNumber: formatOrderNumber(o.number),
    status: o.status,
    deliveryMethod: o.deliveryMethod,
    deliveryCostMinor: o.deliveryCostMinor,
    subtotalMinor: o.subtotalMinor,
    discountMinor: o.discountMinor,
    totalMinor: o.totalMinor,
    contactUsername: o.contactUsername,
    giftName: o.giftName,
    rewardCode: o.reward?.code ?? null,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    items: o.items.map((i) => ({
      productName: i.productName,
      variantName: i.variantName,
      unitPriceMinor: i.unitPriceMinor,
      qty: i.qty,
      lineTotalMinor: i.unitPriceMinor * i.qty,
    })),
  };
}

export function toOrderSnapshot(
  o: OrderRow,
  customer: { telegramId: bigint; username: string | null; firstName: string },
): OrderNotificationSnapshot {
  return {
    orderId: o.id,
    number: o.number,
    status: o.status,
    deliveryMethod: o.deliveryMethod,
    subtotalMinor: o.subtotalMinor,
    discountMinor: o.discountMinor,
    deliveryCostMinor: o.deliveryCostMinor,
    totalMinor: o.totalMinor,
    giftName: o.giftName,
    contactUsername: o.contactUsername,
    customer: {
      telegramId: customer.telegramId.toString(),
      username: customer.username,
      firstName: customer.firstName,
    },
    items: o.items.map((i) => ({
      productName: i.productName,
      variantName: i.variantName,
      qty: i.qty,
      unitPriceMinor: i.unitPriceMinor,
    })),
  };
}

type RewardRow = Prisma.RewardGetPayload<{ include: { prize: { select: { title: true } } } }>;

export function toRewardDto(r: RewardRow): RewardDto {
  return {
    code: r.code,
    title: r.prize.title,
    type: r.type,
    amount: r.amount,
    giftName: r.giftName,
    expiresAt: r.expiresAt.toISOString(),
  };
}

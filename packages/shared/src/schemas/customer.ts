import { z } from 'zod';

import {
  DELIVERY_METHODS,
  MAX_LINE_QTY,
  MAX_ORDER_LINES,
  type DeliveryOption,
  type OrderStatus,
  type PrizeType,
  type Role,
} from '../constants.js';

import { idSchema, telegramUsernameSchema } from './common.js';

// ---------- Requests ----------

export const productListQuerySchema = z.object({
  category: z.string().trim().max(64).optional(),
  q: z.string().trim().max(100).optional(),
  cursor: idSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ProductListQuery = z.infer<typeof productListQuerySchema>;

export const cartItemInputSchema = z.object({
  variantId: z.int().positive(),
  qty: z.int().min(1).max(MAX_LINE_QTY),
});

const cartItemsSchema = z
  .array(cartItemInputSchema)
  .min(1)
  .max(MAX_ORDER_LINES)
  .refine((items) => new Set(items.map((i) => i.variantId)).size === items.length, {
    message: 'Duplicate variants',
  });

export const rewardCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^VH-[A-Z0-9_]+-[A-Z0-9]{4}$/, 'Неверный формат промокода');

export const cartValidateSchema = z.object({
  items: z.array(cartItemInputSchema).max(MAX_ORDER_LINES),
  deliveryMethod: z.enum(DELIVERY_METHODS).default('PICKUP'),
  rewardCode: rewardCodeSchema.optional(),
});
export type CartValidateInput = z.infer<typeof cartValidateSchema>;

export const createOrderSchema = z.object({
  items: cartItemsSchema,
  deliveryMethod: z.enum(DELIVERY_METHODS),
  /** Used only when the Telegram account has no username. */
  contactUsername: telegramUsernameSchema.optional(),
  rewardCode: rewardCodeSchema.optional(),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const idempotencyKeySchema = z.string().trim().min(8).max(100);

// ---------- Responses (types only; server builds them, web consumes them) ----------

export interface MeDto {
  id: number;
  telegramId: string;
  username: string | null;
  firstName: string;
  lastName: string | null;
  role: Role;
  isAdmin: boolean;
  ageConfirmed: boolean;
}

export interface CategoryDto {
  id: number;
  slug: string;
  title: string;
}

export interface VariantDto {
  id: number;
  name: string;
  stock: number;
}

export interface ProductListItemDto {
  id: number;
  name: string;
  categorySlug: string;
  categoryTitle: string;
  priceMinor: number;
  oldPriceMinor: number | null;
  imageUrl: string | null;
  variantCount: number;
  totalStock: number;
}

export interface ProductDto extends ProductListItemDto {
  description: string;
  variants: VariantDto[];
}

export interface RewardDto {
  code: string;
  title: string;
  type: PrizeType;
  amount: number;
  giftName: string | null;
  expiresAt: string;
}

export type CartLineIssue = 'NOT_AVAILABLE' | 'NOT_ENOUGH_STOCK';

export interface CartValidatedLineDto {
  variantId: number;
  productId: number | null;
  productName: string | null;
  variantName: string | null;
  imageUrl: string | null;
  unitPriceMinor: number;
  availableStock: number;
  available: boolean;
  requestedQty: number;
  qty: number;
  issue: CartLineIssue | null;
}

export interface CartValidateDto {
  lines: CartValidatedLineDto[];
  subtotalMinor: number;
  discountMinor: number;
  deliveryCostMinor: number;
  totalMinor: number;
  reward: RewardDto | null;
  rewardError: string | null;
}

export interface OrderItemDto {
  productName: string;
  variantName: string;
  unitPriceMinor: number;
  qty: number;
  lineTotalMinor: number;
}

export interface OrderDto {
  id: number;
  number: number;
  displayNumber: string;
  status: OrderStatus;
  deliveryMethod: (typeof DELIVERY_METHODS)[number];
  deliveryCostMinor: number;
  subtotalMinor: number;
  discountMinor: number;
  totalMinor: number;
  contactUsername: string;
  giftName: string | null;
  rewardCode: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItemDto[];
}

export interface PrizePublicDto {
  key: string;
  label: string;
  title: string;
  color: string;
  type: PrizeType;
}

export interface RouletteStateDto {
  prizes: PrizePublicDto[];
  nextSpinAt: string | null;
  serverTime: string;
  rewards: RewardDto[];
}

export interface SpinResultDto {
  prize: PrizePublicDto;
  prizeIndex: number;
  reward: RewardDto;
  nextSpinAt: string;
  serverTime: string;
}

export interface PublicConfigDto {
  deliveryOptions: readonly DeliveryOption[];
  managerUsername: string;
  mediaBaseUrl: string;
}

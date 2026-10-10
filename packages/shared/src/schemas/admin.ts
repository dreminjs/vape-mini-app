import { z } from 'zod';

import {
  MAX_IMAGE_BYTES,
  MAX_VARIANTS_PER_PRODUCT,
  MIN_VARIANTS_PER_PRODUCT,
  ORDER_STATUSES,
  type OrderStatus,
} from '../constants.js';

import { idSchema, moneyMinorSchema } from './common.js';
import type { OrderDto } from './customer.js';

export const variantInputSchema = z.object({
  /** Existing variant id; omit for a new variant. */
  id: z.int().positive().optional(),
  name: z.string().trim().min(1, 'Введите название').max(100),
  stock: z.int().min(0).max(100_000),
});
export type VariantInput = z.infer<typeof variantInputSchema>;

export const variantListSchema = z
  .array(variantInputSchema)
  .min(MIN_VARIANTS_PER_PRODUCT, 'Нужен хотя бы один вариант')
  .max(MAX_VARIANTS_PER_PRODUCT, `Максимум ${MAX_VARIANTS_PER_PRODUCT} вариантов`)
  .superRefine((variants, ctx) => {
    const seen = new Set<string>();
    variants.forEach((v, index) => {
      const key = v.name.toLowerCase();
      if (seen.has(key)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Такой вариант уже есть',
          path: [index, 'name'],
        });
      }
      seen.add(key);
    });
  });

const productFields = {
  name: z.string().trim().min(2, 'Минимум 2 символа').max(150),
  description: z.string().trim().max(2000),
  categoryId: z.int().positive(),
  priceMinor: moneyMinorSchema.refine((v) => v > 0, 'Цена должна быть больше 0'),
  oldPriceMinor: moneyMinorSchema.nullable(),
  imageKey: z
    .string()
    .regex(/^products\/[A-Za-z0-9/_.-]+$/)
    .nullable(),
};

const oldPriceRule = (p: {
  priceMinor?: number | undefined;
  oldPriceMinor?: number | null | undefined;
}) => p.oldPriceMinor == null || p.priceMinor == null || p.oldPriceMinor > p.priceMinor;
const oldPriceIssue = { message: 'Старая цена должна быть больше цены', path: ['oldPriceMinor'] };

export const createProductSchema = z
  .object({
    ...productFields,
    description: productFields.description.default(''),
    oldPriceMinor: productFields.oldPriceMinor.default(null),
    imageKey: productFields.imageKey.default(null),
    variants: variantListSchema,
  })
  .refine(oldPriceRule, oldPriceIssue);
export type CreateProductInput = z.infer<typeof createProductSchema>;

/** No defaults here: a missing field in PATCH means "do not change". */
export const updateProductSchema = z
  .object(productFields)
  .partial()
  .refine(oldPriceRule, oldPriceIssue);
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const replaceVariantsSchema = z.object({ variants: variantListSchema });

export const stockChangeSchema = z.union([
  z.object({ set: z.int().min(0).max(100_000) }),
  z.object({
    delta: z
      .int()
      .min(-100_000)
      .max(100_000)
      .refine((d) => d !== 0),
  }),
]);
export type StockChangeInput = z.infer<typeof stockChangeSchema>;

export const adminOrdersQuerySchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  q: z.string().trim().max(64).optional(),
  cursor: idSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type AdminOrdersQuery = z.infer<typeof adminOrdersQuerySchema>;

export const updateOrderStatusSchema = z.object({ status: z.enum(ORDER_STATUSES) });

export const analyticsQuerySchema = z.object({
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
});

export const presignSchema = z.object({
  contentType: z.string().regex(/^image\/(png|jpeg|webp|gif|avif)$/, 'Только изображения'),
  size: z.int().min(1).max(MAX_IMAGE_BYTES, 'Максимум 5 МБ'),
});

// ---------- Responses ----------

export interface AdminVariantDto {
  id: number;
  name: string;
  stock: number;
  sortOrder: number;
}

export interface AdminProductDto {
  id: number;
  name: string;
  description: string;
  categoryId: number;
  categoryTitle: string;
  priceMinor: number;
  oldPriceMinor: number | null;
  imageKey: string | null;
  imageUrl: string | null;
  isActive: boolean;
  archivedAt: string | null;
  variants: AdminVariantDto[];
}

export interface AdminOrderDto extends OrderDto {
  customer: { telegramId: string; username: string | null; firstName: string };
}

export interface AnalyticsSummaryDto {
  revenueMinor: number;
  completedCount: number;
  totalStock: number;
  ordersCount: number;
  countsByStatus: Record<OrderStatus, number>;
}

export interface AdminPrizeDto {
  key: string;
  title: string;
  label: string;
  type: string;
  amount: number;
  weight: number;
  probability: number;
  color: string;
  isActive: boolean;
}

export interface PresignDto {
  url: string;
  fields: Record<string, string>;
  key: string;
}

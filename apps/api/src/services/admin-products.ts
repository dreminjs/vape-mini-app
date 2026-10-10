import { Prisma } from '@vapehard/db';
import type {
  AdminProductDto,
  CreateProductInput,
  StockChangeInput,
  UpdateProductInput,
  VariantInput,
} from '@vapehard/shared';

import type { AuthUser, Deps } from '../deps.js';
import { badRequest, conflict, notFound } from '../errors.js';

import { imageUrl } from './mappers.js';

const adminInclude = {
  category: { select: { title: true } },
  variants: { orderBy: { sortOrder: 'asc' } },
} satisfies Prisma.ProductInclude;

type AdminProductRow = Prisma.ProductGetPayload<{ include: typeof adminInclude }>;

function toAdminProduct(p: AdminProductRow, mediaBaseUrl: string): AdminProductDto {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    categoryId: p.categoryId,
    categoryTitle: p.category.title,
    priceMinor: p.priceMinor,
    oldPriceMinor: p.oldPriceMinor,
    imageKey: p.imageKey,
    imageUrl: imageUrl(mediaBaseUrl, p.imageKey),
    isActive: p.isActive,
    archivedAt: p.archivedAt?.toISOString() ?? null,
    variants: p.variants.map((v) => ({
      id: v.id,
      name: v.name,
      stock: v.stock,
      sortOrder: v.sortOrder,
    })),
  };
}

function audit(
  tx: Prisma.TransactionClient,
  admin: AuthUser,
  action: string,
  entity: string,
  entityId: number,
  before: unknown,
  after: unknown,
) {
  return tx.auditLog.create({
    data: {
      adminUserId: admin.id,
      action,
      entity,
      entityId: String(entityId),
      before: toJson(before),
      after: toJson(after),
    },
  });
}

/** Plain JSON copy for audit rows (Dates become ISO strings). */
function toJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (value === null || value === undefined) return Prisma.DbNull;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function assertImageUploaded(deps: Deps, key: string | null | undefined): Promise<void> {
  if (!key) return;
  if (!(await deps.storage.exists(key))) throw badRequest('Изображение не найдено в хранилище');
}

async function removeImageBestEffort(deps: Deps, key: string | null): Promise<void> {
  if (!key) return;
  try {
    await deps.storage.remove(key);
  } catch (error) {
    deps.log.warn({ err: error, key }, 'failed to delete old image');
  }
}

export async function listAdminProducts(deps: Deps): Promise<AdminProductDto[]> {
  const rows = await deps.db.product.findMany({
    where: { archivedAt: null },
    include: adminInclude,
    orderBy: { id: 'desc' },
    take: 200,
  });
  return rows.map((p) => toAdminProduct(p, deps.config.mediaBaseUrl));
}

export async function getAdminProduct(deps: Deps, id: number): Promise<AdminProductDto> {
  const p = await deps.db.product.findUnique({ where: { id }, include: adminInclude });
  if (!p) throw notFound('Товар не найден');
  return toAdminProduct(p, deps.config.mediaBaseUrl);
}

export async function createProduct(
  deps: Deps,
  admin: AuthUser,
  input: CreateProductInput,
): Promise<AdminProductDto> {
  await assertImageUploaded(deps, input.imageKey);
  const { variants, ...fields } = input;
  const product = await deps.db.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        ...fields,
        variants: {
          create: variants.map((v, i) => ({
            name: v.name,
            stock: v.stock,
            sortOrder: i,
            movements: { create: { delta: v.stock, reason: 'INITIAL', adminUserId: admin.id } },
          })),
        },
      },
      include: adminInclude,
    });
    await audit(tx, admin, 'product.create', 'Product', created.id, null, { ...fields, variants });
    return created;
  });
  return toAdminProduct(product, deps.config.mediaBaseUrl);
}

export async function updateProduct(
  deps: Deps,
  admin: AuthUser,
  id: number,
  input: UpdateProductInput,
): Promise<AdminProductDto> {
  const before = await deps.db.product.findUnique({ where: { id } });
  if (!before) throw notFound('Товар не найден');
  if (input.imageKey !== undefined && input.imageKey !== before.imageKey) {
    await assertImageUploaded(deps, input.imageKey);
  }
  // Old price must stay above price also when only one of them changes.
  const price = input.priceMinor ?? before.priceMinor;
  const oldPrice = input.oldPriceMinor === undefined ? before.oldPriceMinor : input.oldPriceMinor;
  if (oldPrice !== null && oldPrice <= price)
    throw badRequest('Старая цена должна быть больше цены');

  const data: Prisma.ProductUncheckedUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.categoryId !== undefined) data.categoryId = input.categoryId;
  if (input.priceMinor !== undefined) data.priceMinor = input.priceMinor;
  if (input.oldPriceMinor !== undefined) data.oldPriceMinor = input.oldPriceMinor;
  if (input.imageKey !== undefined) data.imageKey = input.imageKey;

  const product = await deps.db.$transaction(async (tx) => {
    const updated = await tx.product.update({ where: { id }, data, include: adminInclude });
    await audit(tx, admin, 'product.update', 'Product', id, before, input);
    return updated;
  });
  if (input.imageKey !== undefined && before.imageKey !== input.imageKey) {
    await removeImageBestEffort(deps, before.imageKey);
  }
  return toAdminProduct(product, deps.config.mediaBaseUrl);
}

/** Soft delete: orders keep pointing to the product. */
export async function archiveProduct(
  deps: Deps,
  admin: AuthUser,
  id: number,
): Promise<AdminProductDto> {
  const product = await deps.db.$transaction(async (tx) => {
    const before = await tx.product.findUnique({ where: { id } });
    if (!before) throw notFound('Товар не найден');
    const updated = await tx.product.update({
      where: { id },
      data: { isActive: false, archivedAt: deps.clock() },
      include: adminInclude,
    });
    await audit(
      tx,
      admin,
      'product.archive',
      'Product',
      id,
      { isActive: before.isActive },
      { isActive: false },
    );
    return updated;
  });
  return toAdminProduct(product, deps.config.mediaBaseUrl);
}

/** Replaces the variant list (1–30). Stock differences are written to the ledger. */
export async function replaceVariants(
  deps: Deps,
  admin: AuthUser,
  productId: number,
  variants: VariantInput[],
): Promise<AdminProductDto> {
  const product = await deps.db.$transaction(async (tx) => {
    const existing = await tx.variant.findMany({ where: { productId } });
    if (!(await tx.product.findUnique({ where: { id: productId }, select: { id: true } }))) {
      throw notFound('Товар не найден');
    }
    const byId = new Map(existing.map((v) => [v.id, v]));
    for (const v of variants) {
      if (v.id !== undefined && !byId.has(v.id))
        throw badRequest(`Вариант ${v.id} не принадлежит товару`);
    }

    const keepIds = new Set(variants.flatMap((v) => (v.id === undefined ? [] : [v.id])));
    const removed = existing.filter((v) => !keepIds.has(v.id));
    await tx.variant.deleteMany({ where: { id: { in: removed.map((v) => v.id) } } });

    // Temporary names avoid unique (productId, name) clashes when variants swap names.
    for (const v of variants) {
      if (v.id !== undefined)
        await tx.variant.update({ where: { id: v.id }, data: { name: `__tmp_${v.id}` } });
    }

    for (const [index, v] of variants.entries()) {
      const old = v.id === undefined ? undefined : byId.get(v.id);
      if (old) {
        await tx.variant.update({
          where: { id: old.id },
          data: { name: v.name, stock: v.stock, sortOrder: index },
        });
        if (old.stock !== v.stock) {
          await tx.stockMovement.create({
            data: {
              variantId: old.id,
              delta: v.stock - old.stock,
              reason: 'ADMIN_ADJUST',
              adminUserId: admin.id,
            },
          });
        }
      } else {
        await tx.variant.create({
          data: {
            productId,
            name: v.name,
            stock: v.stock,
            sortOrder: index,
            movements: { create: { delta: v.stock, reason: 'INITIAL', adminUserId: admin.id } },
          },
        });
      }
    }

    await audit(tx, admin, 'product.variants', 'Product', productId, existing, variants);
    return tx.product.findUniqueOrThrow({ where: { id: productId }, include: adminInclude });
  });
  return toAdminProduct(product, deps.config.mediaBaseUrl);
}

/** Absolute set or relative delta. Stock never goes below zero. */
export async function changeStock(
  deps: Deps,
  admin: AuthUser,
  variantId: number,
  input: StockChangeInput,
): Promise<{ id: number; stock: number }> {
  return deps.db.$transaction(async (tx) => {
    const before = await tx.variant.findUnique({ where: { id: variantId } });
    if (!before) throw notFound('Вариант не найден');

    let after: number;
    if ('set' in input) {
      await tx.variant.update({ where: { id: variantId }, data: { stock: input.set } });
      after = input.set;
    } else {
      const { count } = await tx.variant.updateMany({
        where: { id: variantId, ...(input.delta < 0 ? { stock: { gte: -input.delta } } : {}) },
        data: { stock: { increment: input.delta } },
      });
      if (count === 0) throw conflict('CONFLICT', 'Остаток не может быть меньше нуля');
      after = (await tx.variant.findUniqueOrThrow({ where: { id: variantId } })).stock;
    }

    const delta = after - before.stock;
    if (delta !== 0) {
      await tx.stockMovement.create({
        data: { variantId, delta, reason: 'ADMIN_ADJUST', adminUserId: admin.id },
      });
    }
    await audit(
      tx,
      admin,
      'variant.stock',
      'Variant',
      variantId,
      { stock: before.stock },
      { stock: after },
    );
    return { id: variantId, stock: after };
  });
}

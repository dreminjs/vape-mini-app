import type { Prisma } from '@vapehard/db';
import type {
  CategoryDto,
  Page,
  ProductDto,
  ProductListItemDto,
  ProductListQuery,
} from '@vapehard/shared';

import type { Deps } from '../deps.js';
import { notFound } from '../errors.js';

import { productWithVariants, toProductDto, toProductListItem } from './mappers.js';

export const activeProductWhere = {
  isActive: true,
  archivedAt: null,
} satisfies Prisma.ProductWhereInput;

export async function listCategories(deps: Deps): Promise<CategoryDto[]> {
  return deps.db.category.findMany({
    select: { id: true, slug: true, title: true },
    orderBy: { sortOrder: 'asc' },
  });
}

/** Cursor pagination by id (newest first). */
export async function listProducts(
  deps: Deps,
  query: ProductListQuery,
): Promise<Page<ProductListItemDto>> {
  const where: Prisma.ProductWhereInput = {
    ...activeProductWhere,
    ...(query.category ? { category: { slug: query.category } } : {}),
    ...(query.q ? { name: { contains: query.q, mode: 'insensitive' } } : {}),
    ...(query.cursor ? { id: { lt: query.cursor } } : {}),
  };
  const rows = await deps.db.product.findMany({
    where,
    include: productWithVariants,
    orderBy: { id: 'desc' },
    take: query.limit + 1,
  });
  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;
  return {
    items: page.map((p) => toProductListItem(p, deps.config.mediaBaseUrl)),
    nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
  };
}

export async function getProduct(deps: Deps, id: number): Promise<ProductDto> {
  const product = await deps.db.product.findFirst({
    where: { id, ...activeProductWhere },
    include: productWithVariants,
  });
  if (!product) throw notFound('Товар не найден');
  return toProductDto(product, deps.config.mediaBaseUrl);
}

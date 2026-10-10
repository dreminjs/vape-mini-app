// Idempotent seed: safe to run many times. Existing products (matched by name) are not changed.
// Imports the built package (self-reference), so it also works in the Docker image without src/.
import { createPrismaClient } from '@vapehard/db';

import { CATEGORIES, PRIZES, PRODUCTS } from './seed-data.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

const prisma = createPrismaClient(databaseUrl);

async function main(): Promise<void> {
  const categoryIds = new Map<string, number>();
  for (const c of CATEGORIES) {
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { title: c.title, sortOrder: c.sortOrder },
      create: c,
    });
    categoryIds.set(c.slug, row.id);
  }

  for (const p of PRODUCTS) {
    const exists = await prisma.product.findFirst({
      where: { name: p.name },
      select: { id: true },
    });
    if (exists) continue;
    const categoryId = categoryIds.get(p.category);
    if (categoryId === undefined) throw new Error(`Unknown category ${p.category}`);
    await prisma.product.create({
      data: {
        name: p.name,
        description: p.description,
        priceMinor: p.priceMinor,
        oldPriceMinor: p.oldPriceMinor,
        categoryId,
        variants: {
          create: p.variants.map((v, i) => ({
            name: v.name,
            stock: v.stock,
            sortOrder: i,
            movements: { create: { delta: v.stock, reason: 'INITIAL' } },
          })),
        },
      },
    });
  }

  for (const [i, prize] of PRIZES.entries()) {
    await prisma.roulettePrize.upsert({
      where: { key: prize.key },
      update: { ...prize, sortOrder: i },
      create: { ...prize, sortOrder: i },
    });
  }

  process.stdout.write('Seed done\n');
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`Seed failed: ${String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

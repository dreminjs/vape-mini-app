import {
  calcTotals,
  getDeliveryOption,
  type CartValidateDto,
  type CartValidateInput,
  type CartValidatedLineDto,
} from '@vapehard/shared';

import type { AuthUser, Deps } from '../deps.js';

import { imageUrl, toRewardDto } from './mappers.js';
import { checkReward } from './rewards.js';

/** Returns fresh prices, stock and totals. Read-only: nothing is reserved. */
export async function validateCart(
  deps: Deps,
  user: AuthUser,
  input: CartValidateInput,
): Promise<CartValidateDto> {
  const ids = input.items.map((i) => i.variantId);
  const variants = await deps.db.variant.findMany({
    where: { id: { in: ids } },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          priceMinor: true,
          imageKey: true,
          isActive: true,
          archivedAt: true,
        },
      },
    },
  });
  const byId = new Map(variants.map((v) => [v.id, v]));

  const lines: CartValidatedLineDto[] = input.items.map((item) => {
    const v = byId.get(item.variantId);
    const available = v !== undefined && v.product.isActive && v.product.archivedAt === null;
    if (!v || !available) {
      return {
        variantId: item.variantId,
        productId: v?.product.id ?? null,
        productName: v?.product.name ?? null,
        variantName: v?.name ?? null,
        imageUrl: null,
        unitPriceMinor: 0,
        availableStock: 0,
        available: false,
        requestedQty: item.qty,
        qty: 0,
        issue: 'NOT_AVAILABLE',
      };
    }
    const qty = Math.min(item.qty, v.stock);
    return {
      variantId: v.id,
      productId: v.product.id,
      productName: v.product.name,
      variantName: v.name,
      imageUrl: imageUrl(deps.config.mediaBaseUrl, v.product.imageKey),
      unitPriceMinor: v.product.priceMinor,
      availableStock: v.stock,
      available: true,
      requestedQty: item.qty,
      qty,
      issue: qty < item.qty ? 'NOT_ENOUGH_STOCK' : null,
    };
  });

  let reward: CartValidateDto['reward'] = null;
  let rewardError: string | null = null;
  if (input.rewardCode) {
    const check = await checkReward(deps.db, input.rewardCode, user.id, deps.clock());
    if (check.ok) reward = toRewardDto(check.reward);
    else rewardError = check.message;
  }

  const totals = calcTotals(
    lines.map((l) => ({ unitPriceMinor: l.unitPriceMinor, qty: l.qty })),
    getDeliveryOption(input.deliveryMethod).costMinor,
    reward,
  );
  return { lines, ...totals, reward, rewardError };
}

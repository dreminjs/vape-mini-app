import { keepPreviousData, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import type { CartLine, CreateOrderInput, DeliveryMethod } from '@vapehard/shared';

import { client, unwrap, withSignal } from '../../shared/lib/api';
import { catalogKeys } from '../catalog/api';
import { orderKeys } from '../orders/api';
import { rouletteKeys } from '../roulette/api';

import { useCartStore } from './store';

export const cartKeys = {
  validate: (
    items: { variantId: number; qty: number }[],
    delivery: DeliveryMethod,
    reward: string | null,
  ) => ['cart', 'validate', { items, delivery, reward }] as const,
};

/** Read-only server check of prices, stock and the reward. */
export const cartValidateQuery = (
  lines: CartLine[],
  delivery: DeliveryMethod,
  rewardCode: string | null,
) => {
  const items = lines.map((l) => ({ variantId: l.variantId, qty: l.qty }));
  return queryOptions({
    queryKey: cartKeys.validate(items, delivery, rewardCode),
    queryFn: async ({ signal }) => {
      const result = await unwrap(
        client.cart.validate.$post(
          { json: { items, deliveryMethod: delivery, ...(rewardCode ? { rewardCode } : {}) } },
          withSignal(signal),
        ),
      );
      // Fresh server prices and stock are written back to the cart store right away.
      useCartStore.getState().applyServer(result.lines);
      return result;
    },
    enabled: items.length > 0,
    staleTime: 0,
    placeholderData: keepPreviousData,
  });
};

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: CreateOrderInput; idempotencyKey: string }) =>
      unwrap(
        client.orders.$post({ json: input }, { headers: { 'idempotency-key': idempotencyKey } }),
      ),
    // Errors are handled by the page (out-of-stock banner), not by the global toast.
    onError: () => undefined,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: orderKeys.all });
      void qc.invalidateQueries({ queryKey: rouletteKeys.state });
      void qc.invalidateQueries({ queryKey: catalogKeys.all });
    },
  });
}

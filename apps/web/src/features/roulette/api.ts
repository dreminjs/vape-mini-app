import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';

import { ApiError, client, unwrap, withSignal } from '../../shared/lib/api';

export const rouletteKeys = {
  state: ['roulette', 'state'] as const,
};

export const rouletteStateQuery = () =>
  queryOptions({
    queryKey: rouletteKeys.state,
    queryFn: async ({ signal }) => {
      const sentAt = Date.now();
      const state = await unwrap(client.roulette.state.$get({}, withSignal(signal)));
      // Offset between server and device clocks; the countdown never trusts the device clock alone.
      return { ...state, clockOffsetMs: Date.parse(state.serverTime) - (sentAt + Date.now()) / 2 };
    },
  });

export function useSpin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(client.roulette.spin.$post()),
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'ROULETTE_COOLDOWN') {
        void qc.invalidateQueries({ queryKey: rouletteKeys.state });
      }
    },
  });
}

import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';

import { client, unwrap, withSignal } from '../../shared/lib/api';

export const sessionKeys = {
  me: ['session', 'me'] as const,
  config: ['session', 'config'] as const,
};

export const meQuery = () =>
  queryOptions({
    queryKey: sessionKeys.me,
    queryFn: ({ signal }) => unwrap(client.me.$get({}, withSignal(signal))),
    staleTime: 5 * 60_000,
  });

export const publicConfigQuery = () =>
  queryOptions({
    queryKey: sessionKeys.config,
    queryFn: ({ signal }) => unwrap(client.config.public.$get({}, withSignal(signal))),
    staleTime: Infinity,
  });

export function useConfirmAge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(client.me['confirm-age'].$post()),
    onSuccess: (me) => {
      qc.setQueryData(sessionKeys.me, me);
    },
  });
}

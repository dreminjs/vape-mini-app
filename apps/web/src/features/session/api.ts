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

export function useAdminLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (password: string) =>
      unwrap(client.me['admin-login'].$post({ json: { password } })),
    // The page shows the error inline (wrong password / too many attempts).
    onError: () => undefined,
    onSuccess: (me) => {
      qc.setQueryData(sessionKeys.me, me);
    },
  });
}

export function useAdminLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(client.me['admin-logout'].$post()),
    onSuccess: (me) => {
      qc.setQueryData(sessionKeys.me, me);
      qc.removeQueries({ queryKey: ['admin'] });
    },
  });
}

import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';

import { client, unwrap, withSignal } from '../../shared/lib/api';

export const orderKeys = {
  all: ['orders'] as const,
  list: () => [...orderKeys.all, 'list'] as const,
  detail: (id: number) => [...orderKeys.all, 'detail', id] as const,
};

export const ordersInfiniteQuery = () =>
  infiniteQueryOptions({
    queryKey: orderKeys.list(),
    queryFn: ({ pageParam, signal }) =>
      unwrap(
        client.orders.$get(
          { query: { limit: '20', ...(pageParam ? { cursor: String(pageParam) } : {}) } },
          withSignal(signal),
        ),
      ),
    initialPageParam: null as number | null,
    getNextPageParam: (last) => last.nextCursor,
  });

export const orderQuery = (id: number) =>
  queryOptions({
    queryKey: orderKeys.detail(id),
    queryFn: ({ signal }) =>
      unwrap(client.orders[':id'].$get({ param: { id: String(id) } }, withSignal(signal))),
  });

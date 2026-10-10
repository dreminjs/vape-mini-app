import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';

import { client, unwrap, withSignal } from '../../shared/lib/api';

export const catalogKeys = {
  all: ['catalog'] as const,
  categories: () => [...catalogKeys.all, 'categories'] as const,
  lists: () => [...catalogKeys.all, 'list'] as const,
  list: (category: string | undefined, q: string | undefined) =>
    [...catalogKeys.lists(), { category, q }] as const,
  product: (id: number) => [...catalogKeys.all, 'product', id] as const,
};

export const categoriesQuery = () =>
  queryOptions({
    queryKey: catalogKeys.categories(),
    queryFn: ({ signal }) => unwrap(client.categories.$get({}, withSignal(signal))),
    staleTime: 10 * 60_000,
  });

const PAGE_SIZE = 20;

export const productsInfiniteQuery = (category: string | undefined, q: string | undefined) =>
  infiniteQueryOptions({
    queryKey: catalogKeys.list(category, q),
    queryFn: ({ pageParam, signal }) =>
      unwrap(
        client.products.$get(
          {
            query: {
              limit: String(PAGE_SIZE),
              ...(category ? { category } : {}),
              ...(q ? { q } : {}),
              ...(pageParam ? { cursor: String(pageParam) } : {}),
            },
          },
          withSignal(signal),
        ),
      ),
    initialPageParam: null as number | null,
    getNextPageParam: (last) => last.nextCursor,
  });

export const productQuery = (id: number) =>
  queryOptions({
    queryKey: catalogKeys.product(id),
    queryFn: ({ signal }) =>
      unwrap(client.products[':id'].$get({ param: { id: String(id) } }, withSignal(signal))),
  });

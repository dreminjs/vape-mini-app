import { QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { ApiError } from './api';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        // No retry on 4xx; up to 2 retries on network and 5xx errors.
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.isClientError) && failureCount < 2,
      },
      mutations: {
        onError: (error) => {
          toast.error(error instanceof ApiError ? error.message : 'Что-то пошло не так');
        },
      },
    },
  });
}

/** One client for the app; route loaders use it too. */
export const queryClient = createQueryClient();

/**
 * Loader helpers: return cached data or fetch once.
 * Replaces the deprecated ensureQueryData / ensureInfiniteQueryData.
 */
export const prefetch: QueryClient['query'] = (options) =>
  queryClient.query({ ...options, staleTime: 'static' });

export const prefetchInfinite: QueryClient['infiniteQuery'] = (options) =>
  queryClient.infiniteQuery({ ...options, staleTime: 'static' });

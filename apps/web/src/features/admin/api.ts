import {
  infiniteQueryOptions,
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import type {
  AdminOrderDto,
  AdminProductDto,
  CreateProductInput,
  OrderStatus,
  Page,
  UpdateProductInput,
  VariantInput,
} from '@vapehard/shared';

import { client, unwrap, withSignal } from '../../shared/lib/api';
import { catalogKeys } from '../catalog/api';

const admin = client.admin;

export const adminKeys = {
  all: ['admin'] as const,
  products: () => [...adminKeys.all, 'products'] as const,
  product: (id: number) => [...adminKeys.all, 'product', id] as const,
  ordersAll: () => [...adminKeys.all, 'orders'] as const,
  orders: (status: OrderStatus | undefined, q: string) =>
    [...adminKeys.ordersAll(), { status, q }] as const,
  analytics: (from: string | undefined, to: string | undefined) =>
    [...adminKeys.all, 'analytics', { from, to }] as const,
  prizes: () => [...adminKeys.all, 'prizes'] as const,
};

export const adminProductsQuery = () =>
  queryOptions({
    queryKey: adminKeys.products(),
    queryFn: ({ signal }) => unwrap(admin.products.$get({}, withSignal(signal))),
  });

export const adminProductQuery = (id: number) =>
  queryOptions({
    queryKey: adminKeys.product(id),
    queryFn: ({ signal }) =>
      unwrap(admin.products[':id'].$get({ param: { id: String(id) } }, withSignal(signal))),
  });

export const adminOrdersQuery = (status: OrderStatus | undefined, q: string) =>
  infiniteQueryOptions({
    queryKey: adminKeys.orders(status, q),
    queryFn: ({ pageParam, signal }) =>
      unwrap(
        admin.orders.$get(
          {
            query: {
              limit: '20',
              ...(status ? { status } : {}),
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

export const analyticsQuery = (from: string | undefined, to: string | undefined) =>
  queryOptions({
    queryKey: adminKeys.analytics(from, to),
    queryFn: ({ signal }) =>
      unwrap(
        admin.analytics.summary.$get(
          { query: { ...(from ? { from } : {}), ...(to ? { to } : {}) } },
          withSignal(signal),
        ),
      ),
  });

export const prizesQuery = () =>
  queryOptions({
    queryKey: adminKeys.prizes(),
    queryFn: ({ signal }) => unwrap(admin.roulette.prizes.$get({}, withSignal(signal))),
    staleTime: 5 * 60_000,
  });

/** Catalog data changes when admins edit products. */
function useInvalidateProducts() {
  const qc = useQueryClient();
  return (id?: number) => {
    void qc.invalidateQueries({ queryKey: adminKeys.products() });
    if (id !== undefined) void qc.invalidateQueries({ queryKey: adminKeys.product(id) });
    void qc.invalidateQueries({ queryKey: catalogKeys.all });
  };
}

/** Optimistic stock edit with rollback on error. */
export function useChangeStock() {
  const qc = useQueryClient();
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: ({ variantId, stock }: { variantId: number; stock: number; productId: number }) =>
      unwrap(
        admin.variants[':id'].stock.$post({
          param: { id: String(variantId) },
          json: { set: stock },
        }),
      ),
    onMutate: async ({ variantId, stock }) => {
      await qc.cancelQueries({ queryKey: adminKeys.products() });
      const previous = qc.getQueryData<AdminProductDto[]>(adminKeys.products());
      qc.setQueryData<AdminProductDto[]>(adminKeys.products(), (list) =>
        list?.map((p) => ({
          ...p,
          variants: p.variants.map((v) => (v.id === variantId ? { ...v, stock } : v)),
        })),
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) qc.setQueryData(adminKeys.products(), context.previous);
    },
    onSettled: (_data, _error, vars) => {
      invalidate(vars.productId);
    },
  });
}

export function useReplaceVariants() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: ({ productId, variants }: { productId: number; variants: VariantInput[] }) =>
      unwrap(
        admin.products[':id'].variants.$put({
          param: { id: String(productId) },
          json: { variants },
        }),
      ),
    onSuccess: (p) => {
      invalidate(p.id);
    },
  });
}

export function useArchiveProduct() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: (id: number) =>
      unwrap(admin.products[':id'].archive.$post({ param: { id: String(id) } })),
    onSuccess: (p) => {
      invalidate(p.id);
    },
  });
}

export function useCreateProduct() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: (input: CreateProductInput) => unwrap(admin.products.$post({ json: input })),
    onSuccess: () => {
      invalidate();
    },
  });
}

export function useUpdateProduct() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateProductInput }) =>
      unwrap(admin.products[':id'].$patch({ param: { id: String(id) }, json: input })),
    onSuccess: (p) => {
      invalidate(p.id);
    },
  });
}

export function usePresign() {
  return useMutation({
    mutationFn: (file: File) =>
      unwrap(admin.uploads.presign.$post({ json: { contentType: file.type, size: file.size } })),
  });
}

type OrdersPages = { pages: Page<AdminOrderDto>[]; pageParams: unknown[] };

/** Optimistic status change across all cached admin order lists. */
export function useChangeOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: OrderStatus }) =>
      unwrap(admin.orders[':id'].status.$patch({ param: { id: String(id) }, json: { status } })),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: adminKeys.ordersAll() });
      const snapshot = qc.getQueriesData<OrdersPages>({ queryKey: adminKeys.ordersAll() });
      qc.setQueriesData<OrdersPages>({ queryKey: adminKeys.ordersAll() }, (data) =>
        data
          ? {
              ...data,
              pages: data.pages.map((page) => ({
                ...page,
                items: page.items.map((o) => (o.id === id ? { ...o, status } : o)),
              })),
            }
          : data,
      );
      return { snapshot };
    },
    onError: (_error, _vars, context) => {
      for (const [key, data] of context?.snapshot ?? []) qc.setQueryData(key, data);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.ordersAll() });
      void qc.invalidateQueries({ queryKey: [...adminKeys.all, 'analytics'] });
      void qc.invalidateQueries({ queryKey: adminKeys.products() });
    },
  });
}

/** Upload with progress: XHR is used because fetch has no upload progress events. */
export function uploadToPresignedPost(
  url: string,
  fields: Record<string, string>,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const body = new FormData();
    for (const [k, v] of Object.entries(fields)) body.append(k, v);
    body.append('file', file);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed: ${String(xhr.status)}`));
    };
    xhr.onerror = () => {
      reject(new Error('Upload failed'));
    };
    xhr.send(body);
  });
}

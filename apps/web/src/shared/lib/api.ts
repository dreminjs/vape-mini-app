import type { AppType } from '@vapehard/api';
import type { ApiErrorBody, ErrorCode } from '@vapehard/shared';
import { hc, type ClientResponse } from 'hono/client';

import { getRawInitData } from './telegram';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | 'NETWORK',
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }
}

/** Typed client: paths and bodies are checked against the API at compile time. */
export const client = hc<AppType>(`${window.location.origin}/`, {
  headers: (): Record<string, string> => {
    const raw = getRawInitData();
    return raw ? { authorization: `tma ${raw}` } : {};
  },
}).api.v1;

type SuccessCode = 200 | 201;
type SuccessBody<R> =
  R extends ClientResponse<infer T, infer S, 'json'> ? (S extends SuccessCode ? T : never) : never;

/** Awaits a client call, throws ApiError on failure, returns the typed success body. */
export async function unwrap<R extends ClientResponse<unknown, number, 'json'>>(
  call: Promise<R>,
): Promise<SuccessBody<R>> {
  let res: R;
  try {
    res = await call;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, 'NETWORK', 'Нет соединения с сервером');
  }
  if (res.ok) return (await res.json()) as SuccessBody<R>;
  let body: Partial<ApiErrorBody> = {};
  try {
    body = (await res.json()) as ApiErrorBody;
  } catch {
    // Non-JSON error page (proxy, gateway).
  }
  throw new ApiError(
    res.status,
    body.error?.code ?? 'INTERNAL',
    body.error?.message ?? 'Ошибка сервера',
    body.error?.details,
  );
}

/** Request options with an AbortSignal (TanStack Query passes one to queryFn). */
export const withSignal = (signal?: AbortSignal) => (signal ? { init: { signal } } : {});

/** Thrown by route loaders for bad ids; RouteError shows "not found". */
export class NotFoundError extends Error {
  constructor() {
    super('Not found');
    this.name = 'NotFoundError';
  }
}

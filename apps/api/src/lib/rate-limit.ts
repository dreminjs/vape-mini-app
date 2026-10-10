import type { MiddlewareHandler } from 'hono';

import type { AppEnv } from '../deps.js';
import { AppError } from '../errors.js';

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Fixed-window in-memory limiter. Fine for a single API instance;
 * multiple instances would need a shared store (see backlog).
 */
export function rateLimit(opts: {
  windowMs: number;
  max: number;
  name: string;
}): MiddlewareHandler<AppEnv> {
  // State belongs to one app instance (keyed by its deps), not to the module.
  const perApp = new WeakMap<object, Map<string, Bucket>>();
  return async (c, next) => {
    const deps = c.get('deps');
    let buckets = perApp.get(deps);
    if (!buckets) {
      buckets = new Map();
      perApp.set(deps, buckets);
    }
    const now = Date.now();
    const user = c.get('user') as AppEnv['Variables']['user'] | undefined;
    const key = user
      ? `u:${user.id}`
      : `ip:${c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'}`;

    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + opts.windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (buckets.size > 10_000) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    }
    if (bucket.count > opts.max) {
      c.header('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
      throw new AppError(429, 'RATE_LIMITED', 'Слишком много запросов, попробуйте позже', {
        limiter: opts.name,
      });
    }
    await next();
  };
}

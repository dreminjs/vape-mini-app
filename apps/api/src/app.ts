import { Prisma } from '@vapehard/db';
import type { ApiErrorBody } from '@vapehard/shared';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { requestId } from 'hono/request-id';
import { secureHeaders } from 'hono/secure-headers';

import type { AppEnv, Deps } from './deps.js';
import { AppError } from './errors.js';
import { rateLimit } from './lib/rate-limit.js';
import { requireAuth } from './middleware/auth.js';
import { adminRoutes } from './routes/admin.js';
import { meRoutes, shopRoutes } from './routes/customer.js';

function errorBody(
  code: ApiErrorBody['error']['code'],
  message: string,
  details?: unknown,
): ApiErrorBody {
  return { error: { code, message, ...(details === undefined ? {} : { details }) } };
}

export function createApp(deps: Deps) {
  const api = new Hono<AppEnv>()
    .use(rateLimit({ name: 'global', windowMs: 60_000, max: 300 }))
    .use(requireAuth)
    .route('/', meRoutes)
    .route('/admin', adminRoutes)
    .route('/', shopRoutes);

  const app = new Hono<AppEnv>()
    .use(requestId())
    .use(async (c, next) => {
      c.set('deps', deps);
      const start = performance.now();
      await next();
      deps.log.info(
        {
          requestId: c.get('requestId'),
          method: c.req.method,
          path: c.req.path,
          status: c.res.status,
          ms: Math.round(performance.now() - start),
        },
        'request',
      );
    })
    .use(secureHeaders())
    .use(
      bodyLimit({
        maxSize: 64 * 1024,
        onError: () => {
          throw new AppError(413, 'PAYLOAD_TOO_LARGE', 'Слишком большой запрос');
        },
      }),
    )
    .get('/healthz', (c) => c.json({ ok: true }))
    .get('/readyz', async (c) => {
      try {
        await Promise.all([deps.db.$queryRaw`SELECT 1`, deps.storage.ping()]);
        return c.json({ ok: true });
      } catch (error) {
        deps.log.warn({ err: error }, 'readiness check failed');
        return c.json({ ok: false }, 503);
      }
    })
    .route('/api/v1', api);

  app.notFound((c) => c.json(errorBody('NOT_FOUND', 'Маршрут не найден'), 404));

  // One error format for everything. Internal details never leave the server.
  app.onError((error, c) => {
    if (error instanceof AppError) {
      return c.json(errorBody(error.code, error.message, error.details), error.status);
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return c.json(errorBody('CONFLICT', 'Запись с такими данными уже существует'), 409);
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return c.json(errorBody('NOT_FOUND', 'Не найдено'), 404);
    }
    deps.log.error({ err: error, requestId: c.get('requestId') }, 'unhandled error');
    return c.json(errorBody('INTERNAL', 'Внутренняя ошибка сервера'), 500);
  });

  return app;
}

export type AppType = ReturnType<typeof createApp>;

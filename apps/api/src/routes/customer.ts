import {
  cartValidateSchema,
  createOrderSchema,
  cursorQuerySchema,
  DELIVERY_OPTIONS,
  idempotencyKeySchema,
  idParamSchema,
  productListQuerySchema,
  type PublicConfigDto,
} from '@vapehard/shared';
import { Hono } from 'hono';
import { z } from 'zod';

import type { AppEnv } from '../deps.js';
import { AppError } from '../errors.js';
import { rateLimit } from '../lib/rate-limit.js';
import { validate } from '../lib/validate.js';
import { requireAge } from '../middleware/auth.js';
import { validateCart } from '../services/cart.js';
import { getProduct, listCategories, listProducts } from '../services/catalog.js';
import { createOrder, getOwnOrder, listOwnOrders } from '../services/orders.js';
import { getRouletteState, spin } from '../services/roulette.js';
import { adminLogin, adminLogout, confirmAge, toMeDto } from '../services/users.js';

const MINUTE = 60_000;

/** Routes that only need a valid Telegram user (age gate itself, profile, config). */
export const meRoutes = new Hono<AppEnv>()
  .get('/me', (c) => c.json(toMeDto(c.get('user'), c.get('deps').clock())))
  .post('/me/confirm-age', async (c) => {
    const user = await confirmAge(c.get('deps'), c.get('user'));
    return c.json(toMeDto(user, c.get('deps').clock()));
  })
  // Strict limit: 5 password attempts per 15 minutes per user.
  .post(
    '/me/admin-login',
    rateLimit({ name: 'admin-login', windowMs: 15 * MINUTE, max: 5 }),
    validate('json', z.object({ password: z.string().min(1).max(200) })),
    async (c) => {
      const user = await adminLogin(c.get('deps'), c.get('user'), c.req.valid('json').password);
      return c.json(toMeDto(user, c.get('deps').clock()));
    },
  )
  .post('/me/admin-logout', async (c) => {
    const user = await adminLogout(c.get('deps'), c.get('user'));
    return c.json(toMeDto(user, c.get('deps').clock()));
  })
  .get('/config/public', (c) => {
    const { config } = c.get('deps');
    const body: PublicConfigDto = {
      deliveryOptions: DELIVERY_OPTIONS,
      managerUsername: config.managerUsername,
      mediaBaseUrl: config.mediaBaseUrl,
    };
    return c.json(body);
  });

/** Shop routes. Browsing is open; placing an order needs the 18+ confirmation. */
export const shopRoutes = new Hono<AppEnv>()
  .get('/categories', async (c) => c.json(await listCategories(c.get('deps'))))
  .get('/products', validate('query', productListQuerySchema), async (c) =>
    c.json(await listProducts(c.get('deps'), c.req.valid('query'))),
  )
  .get('/products/:id', validate('param', idParamSchema), async (c) =>
    c.json(await getProduct(c.get('deps'), c.req.valid('param').id)),
  )
  .post('/cart/validate', validate('json', cartValidateSchema), async (c) =>
    c.json(await validateCart(c.get('deps'), c.get('user'), c.req.valid('json'))),
  )
  .post(
    '/orders',
    rateLimit({ name: 'orders', windowMs: MINUTE, max: 10 }),
    requireAge,
    validate('json', createOrderSchema),
    async (c) => {
      const key = idempotencyKeySchema.safeParse(c.req.header('idempotency-key'));
      if (!key.success) {
        throw new AppError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Нужен заголовок Idempotency-Key');
      }
      const result = await createOrder(c.get('deps'), c.get('user'), c.req.valid('json'), key.data);
      return c.json(result.order, result.created ? 201 : 200);
    },
  )
  .get('/orders', validate('query', cursorQuerySchema), async (c) => {
    const { cursor, limit } = c.req.valid('query');
    return c.json(await listOwnOrders(c.get('deps'), c.get('user').id, cursor, limit));
  })
  .get('/orders/:id', validate('param', idParamSchema), async (c) =>
    c.json(await getOwnOrder(c.get('deps'), c.get('user').id, c.req.valid('param').id)),
  )
  .get('/roulette/state', async (c) => c.json(await getRouletteState(c.get('deps'), c.get('user'))))
  .post('/roulette/spin', rateLimit({ name: 'spin', windowMs: MINUTE, max: 5 }), async (c) =>
    c.json(await spin(c.get('deps'), c.get('user'))),
  );

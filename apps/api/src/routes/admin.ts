import {
  adminOrdersQuerySchema,
  analyticsQuerySchema,
  createProductSchema,
  idParamSchema,
  presignSchema,
  replaceVariantsSchema,
  stockChangeSchema,
  updateOrderStatusSchema,
  updateProductSchema,
} from '@vapehard/shared';
import { Hono } from 'hono';

import type { AppEnv } from '../deps.js';
import { validate } from '../lib/validate.js';
import { requireAdmin } from '../middleware/auth.js';
import {
  analyticsSummary,
  listAdminOrders,
  listPrizesWithOdds,
  presignUpload,
} from '../services/admin-misc.js';
import {
  archiveProduct,
  changeStock,
  createProduct,
  getAdminProduct,
  listAdminProducts,
  replaceVariants,
  updateProduct,
} from '../services/admin-products.js';
import { changeOrderStatus } from '../services/orders.js';

/** Every route in this group is behind requireAdmin. */
export const adminRoutes = new Hono<AppEnv>()
  .use(requireAdmin)
  .get('/products', async (c) => c.json(await listAdminProducts(c.get('deps'))))
  .get('/products/:id', validate('param', idParamSchema), async (c) =>
    c.json(await getAdminProduct(c.get('deps'), c.req.valid('param').id)),
  )
  .post('/products', validate('json', createProductSchema), async (c) =>
    c.json(await createProduct(c.get('deps'), c.get('user'), c.req.valid('json')), 201),
  )
  .patch(
    '/products/:id',
    validate('param', idParamSchema),
    validate('json', updateProductSchema),
    async (c) =>
      c.json(
        await updateProduct(
          c.get('deps'),
          c.get('user'),
          c.req.valid('param').id,
          c.req.valid('json'),
        ),
      ),
  )
  .post('/products/:id/archive', validate('param', idParamSchema), async (c) =>
    c.json(await archiveProduct(c.get('deps'), c.get('user'), c.req.valid('param').id)),
  )
  .put(
    '/products/:id/variants',
    validate('param', idParamSchema),
    validate('json', replaceVariantsSchema),
    async (c) =>
      c.json(
        await replaceVariants(
          c.get('deps'),
          c.get('user'),
          c.req.valid('param').id,
          c.req.valid('json').variants,
        ),
      ),
  )
  .post(
    '/variants/:id/stock',
    validate('param', idParamSchema),
    validate('json', stockChangeSchema),
    async (c) =>
      c.json(
        await changeStock(
          c.get('deps'),
          c.get('user'),
          c.req.valid('param').id,
          c.req.valid('json'),
        ),
      ),
  )
  .get('/orders', validate('query', adminOrdersQuerySchema), async (c) =>
    c.json(await listAdminOrders(c.get('deps'), c.req.valid('query'))),
  )
  .patch(
    '/orders/:id/status',
    validate('param', idParamSchema),
    validate('json', updateOrderStatusSchema),
    async (c) =>
      c.json(
        await changeOrderStatus(
          c.get('deps'),
          c.get('user'),
          c.req.valid('param').id,
          c.req.valid('json').status,
        ),
      ),
  )
  .get('/analytics/summary', validate('query', analyticsQuerySchema), async (c) =>
    c.json(await analyticsSummary(c.get('deps'), c.req.valid('query'))),
  )
  .get('/roulette/prizes', async (c) => c.json(await listPrizesWithOdds(c.get('deps'))))
  .post('/uploads/presign', validate('json', presignSchema), async (c) =>
    c.json(await presignUpload(c.get('deps'), c.req.valid('json').contentType)),
  );

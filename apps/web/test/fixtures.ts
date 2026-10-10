import type {
  CartValidateDto,
  MeDto,
  OrderDto,
  ProductDto,
  PublicConfigDto,
} from '@vapehard/shared';
import { DELIVERY_OPTIONS } from '@vapehard/shared';
import { http, HttpResponse } from 'msw';

export const API = `${window.location.origin}/api/v1`;

export const me: MeDto = {
  id: 1,
  telegramId: '42',
  username: 'tim_dev',
  firstName: 'Тим',
  lastName: null,
  role: 'CUSTOMER',
  isAdmin: false,
  ageConfirmed: true,
};

export const config: PublicConfigDto = {
  deliveryOptions: DELIVERY_OPTIONS,
  managerUsername: 'VapeHard_manager',
  mediaBaseUrl: '/media/vapehard',
};

export const product: ProductDto = {
  id: 1,
  name: 'Husky Premium 30ml',
  categorySlug: 'liquids',
  categoryTitle: 'Жидкости',
  priceMinor: 2800,
  oldPriceMinor: null,
  imageUrl: null,
  variantCount: 2,
  totalStock: 17,
  description: 'Премиальная линейка жидкостей',
  variants: [
    { id: 10, name: 'Miami Snow', stock: 12 },
    { id: 11, name: 'Big Ball', stock: 0 },
  ],
};

export const order: OrderDto = {
  id: 5,
  number: 1001,
  displayNumber: 'VH-1001',
  status: 'PROCESSING',
  deliveryMethod: 'PICKUP',
  deliveryCostMinor: 0,
  subtotalMinor: 2800,
  discountMinor: 0,
  totalMinor: 2800,
  contactUsername: 'tim_dev',
  giftName: null,
  rewardCode: null,
  createdAt: '2026-10-10T12:00:00.000Z',
  updatedAt: '2026-10-10T12:00:00.000Z',
  items: [
    {
      productName: product.name,
      variantName: 'Miami Snow',
      unitPriceMinor: 2800,
      qty: 1,
      lineTotalMinor: 2800,
    },
  ],
};

export function validated(items: { variantId: number; qty: number }[]): CartValidateDto {
  const lines = items.map((i) => ({
    variantId: i.variantId,
    productId: 1,
    productName: product.name,
    variantName: 'Miami Snow',
    imageUrl: null,
    unitPriceMinor: 2800,
    availableStock: 12,
    available: true,
    requestedQty: i.qty,
    qty: i.qty,
    issue: null,
  }));
  const subtotal = lines.reduce((s, l) => s + l.unitPriceMinor * l.qty, 0);
  return {
    lines,
    subtotalMinor: subtotal,
    discountMinor: 0,
    deliveryCostMinor: 0,
    totalMinor: subtotal,
    reward: null,
    rewardError: null,
  };
}

export const handlers = [
  http.get(`${API}/me`, () => HttpResponse.json(me)),
  http.get(`${API}/config/public`, () => HttpResponse.json(config)),
  http.get(`${API}/categories`, () =>
    HttpResponse.json([{ id: 1, slug: 'liquids', title: 'Жидкости' }]),
  ),
  http.get(`${API}/products`, ({ request }) => {
    const q = new URL(request.url).searchParams.get('q');
    const items = q && !product.name.toLowerCase().includes(q.toLowerCase()) ? [] : [product];
    return HttpResponse.json({ items, nextCursor: null });
  }),
  http.get(`${API}/products/:id`, () => HttpResponse.json(product)),
  http.post(`${API}/cart/validate`, async ({ request }) => {
    const body = (await request.json()) as { items: { variantId: number; qty: number }[] };
    return HttpResponse.json(validated(body.items));
  }),
  http.post(`${API}/orders`, () => HttpResponse.json(order, { status: 201 })),
];

import { client, unwrap } from './shared/lib/api';
export async function probe() {
  const p = await unwrap(client.products.$get({ query: { limit: '5' } }));
  const n: number | null = p.nextCursor;
  const o = await unwrap(
    client.orders.$post(
      { json: { items: [{ variantId: 1, qty: 1 }], deliveryMethod: 'PICKUP' } },
      { headers: { 'idempotency-key': 'x' } },
    ),
  );
  const s: string = o.displayNumber;
  return [n, s];
}

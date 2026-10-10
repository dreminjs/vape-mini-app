import { MAX_LINE_QTY } from '../constants.js';

export interface CartLine {
  productId: number;
  variantId: number;
  productName: string;
  variantName: string;
  /** Display only. The server recalculates prices. */
  unitPriceMinor: number;
  imageUrl: string | null;
  qty: number;
  maxStock: number;
}

export interface CartAddInput extends Omit<CartLine, 'qty'> {
  qty: number;
}

function clampQty(qty: number, maxStock: number): number {
  return Math.max(0, Math.min(Math.floor(qty), maxStock, MAX_LINE_QTY));
}

/** Adds lines, merging by variant and clamping to stock. Lines with 0 qty are dropped. */
export function addToCart(cart: readonly CartLine[], inputs: readonly CartAddInput[]): CartLine[] {
  const next = cart.map((line) => ({ ...line }));
  for (const input of inputs) {
    const existing = next.find((line) => line.variantId === input.variantId);
    if (existing) {
      existing.maxStock = input.maxStock;
      existing.unitPriceMinor = input.unitPriceMinor;
      existing.qty = clampQty(existing.qty + input.qty, input.maxStock);
    } else {
      next.push({ ...input, qty: clampQty(input.qty, input.maxStock) });
    }
  }
  return next.filter((line) => line.qty > 0);
}

export function setLineQty(cart: readonly CartLine[], variantId: number, qty: number): CartLine[] {
  return cart
    .map((line) =>
      line.variantId === variantId ? { ...line, qty: clampQty(qty, line.maxStock) } : line,
    )
    .filter((line) => line.qty > 0);
}

export function removeLine(cart: readonly CartLine[], variantId: number): CartLine[] {
  return cart.filter((line) => line.variantId !== variantId);
}

export function cartItemCount(cart: readonly CartLine[]): number {
  return cart.reduce((sum, line) => sum + line.qty, 0);
}

export interface ValidatedLine {
  variantId: number;
  unitPriceMinor: number;
  availableStock: number;
  /** false when the product or variant no longer exists or is archived. */
  available: boolean;
}

export interface CartSyncResult {
  cart: CartLine[];
  priceChanged: number[];
  stockReduced: number[];
  removed: number[];
}

/** Applies fresh server data to the cart and reports what changed (for UI banners). */
export function syncCartWithServer(
  cart: readonly CartLine[],
  validated: readonly ValidatedLine[],
): CartSyncResult {
  const result: CartSyncResult = { cart: [], priceChanged: [], stockReduced: [], removed: [] };
  for (const line of cart) {
    const fresh = validated.find((v) => v.variantId === line.variantId);
    if (!fresh?.available || fresh.availableStock <= 0) {
      result.removed.push(line.variantId);
      continue;
    }
    if (fresh.unitPriceMinor !== line.unitPriceMinor) result.priceChanged.push(line.variantId);
    const qty = clampQty(line.qty, fresh.availableStock);
    if (qty < line.qty) result.stockReduced.push(line.variantId);
    result.cart.push({
      ...line,
      unitPriceMinor: fresh.unitPriceMinor,
      maxStock: fresh.availableStock,
      qty,
    });
  }
  return result;
}

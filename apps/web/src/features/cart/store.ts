import {
  addToCart,
  cartItemCount,
  removeLine,
  setLineQty,
  syncCartWithServer,
  type CartAddInput,
  type CartLine,
  type DeliveryMethod,
  type ValidatedLine,
} from '@vapehard/shared';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface CartBanners {
  priceChanged: boolean;
  stockReduced: boolean;
  removed: boolean;
}

const NO_BANNERS: CartBanners = { priceChanged: false, stockReduced: false, removed: false };

interface CartState {
  /** UI-only notices about server corrections; not persisted. */
  banners: CartBanners;
  applyServer: (validated: ValidatedLine[]) => void;
  lines: CartLine[];
  deliveryMethod: DeliveryMethod;
  /** Only the code is stored; the server validates it every time. */
  rewardCode: string | null;
  add: (inputs: CartAddInput[]) => void;
  setQty: (variantId: number, qty: number) => void;
  remove: (variantId: number) => void;
  setDelivery: (method: DeliveryMethod) => void;
  setRewardCode: (code: string | null) => void;
  clear: () => void;
}

/** Cart is the only data kept in localStorage (allowed by the spec). */
export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      deliveryMethod: 'PICKUP',
      rewardCode: null,
      add: (inputs) => {
        set((s) => ({ lines: addToCart(s.lines, inputs) }));
      },
      setQty: (variantId, qty) => {
        set((s) => ({ lines: setLineQty(s.lines, variantId, qty) }));
      },
      remove: (variantId) => {
        set((s) => ({ lines: removeLine(s.lines, variantId) }));
      },
      banners: NO_BANNERS,
      applyServer: (validated) => {
        set((s) => {
          const r = syncCartWithServer(s.lines, validated);
          if (r.priceChanged.length + r.stockReduced.length + r.removed.length === 0) return s;
          return {
            lines: r.cart,
            banners: {
              priceChanged: s.banners.priceChanged || r.priceChanged.length > 0,
              stockReduced: s.banners.stockReduced || r.stockReduced.length > 0,
              removed: s.banners.removed || r.removed.length > 0,
            },
          };
        });
      },
      setDelivery: (deliveryMethod) => {
        set({ deliveryMethod });
      },
      setRewardCode: (rewardCode) => {
        set({ rewardCode });
      },
      clear: () => {
        set({ lines: [], rewardCode: null, banners: NO_BANNERS });
      },
    }),
    {
      name: 'vh-cart',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        lines: s.lines,
        deliveryMethod: s.deliveryMethod,
        rewardCode: s.rewardCode,
      }),
    },
  ),
);

// Selectors: components subscribe to slices, never to the whole store.
export const selectLines = (s: CartState) => s.lines;
export const selectCount = (s: CartState) => cartItemCount(s.lines);
export const selectDelivery = (s: CartState) => s.deliveryMethod;
export const selectRewardCode = (s: CartState) => s.rewardCode;
export const selectBanners = (s: CartState) => s.banners;

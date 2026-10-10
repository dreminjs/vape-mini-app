/** Order statuses. Labels are user-facing (Russian). */
export const ORDER_STATUSES = [
  'PROCESSING',
  'HANDED_TO_COURIER',
  'COMPLETED',
  'CANCELLED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PROCESSING: 'В обработке',
  HANDED_TO_COURIER: 'Передан курьеру',
  COMPLETED: 'Завершен',
  CANCELLED: 'Отменен',
};

export const DELIVERY_METHODS = ['PICKUP', 'COURIER', 'EVROPOCHTA'] as const;
export type DeliveryMethod = (typeof DELIVERY_METHODS)[number];

export interface DeliveryOption {
  method: DeliveryMethod;
  title: string;
  costMinor: number;
}

/** Single source for delivery prices. The API serves this through /config/public. */
export const DELIVERY_OPTIONS: readonly DeliveryOption[] = [
  { method: 'PICKUP', title: 'Самовывоз (Минск)', costMinor: 0 },
  { method: 'COURIER', title: 'Курьер по Минску', costMinor: 1500 },
  { method: 'EVROPOCHTA', title: 'Европочта по Беларуси', costMinor: 600 },
];

export function getDeliveryOption(method: DeliveryMethod): DeliveryOption {
  const option = DELIVERY_OPTIONS.find((o) => o.method === method);
  if (!option) throw new Error(`Unknown delivery method: ${method}`);
  return option;
}

export const PRIZE_TYPES = ['FIXED', 'PERCENT', 'GIFT'] as const;
export type PrizeType = (typeof PRIZE_TYPES)[number];

export const ROLES = ['CUSTOMER', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const MAX_VARIANTS_PER_PRODUCT = 30;
export const MIN_VARIANTS_PER_PRODUCT = 1;
export const MAX_ORDER_LINES = 50;
export const MAX_LINE_QTY = 99;
export const ROULETTE_COOLDOWN_MS = 24 * 60 * 60 * 1000;
export const ROULETTE_WEIGHT_TOTAL = 1_000_000;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const LOW_STOCK_THRESHOLD = 3;

export const ERROR_CODES = [
  'BAD_REQUEST',
  'VALIDATION_FAILED',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'AGE_NOT_CONFIRMED',
  'NOT_FOUND',
  'CONFLICT',
  'OUT_OF_STOCK',
  'INVALID_STATUS_TRANSITION',
  'REWARD_INVALID',
  'ROULETTE_COOLDOWN',
  'IDEMPOTENCY_KEY_REQUIRED',
  'RATE_LIMITED',
  'PAYLOAD_TOO_LARGE',
  'INTERNAL',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

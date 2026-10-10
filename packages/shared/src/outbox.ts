import type { DeliveryMethod, OrderStatus } from './constants.js';

/** Snapshot sent through the outbox. The bot formats messages from it without extra DB reads. */
export interface OrderNotificationSnapshot {
  orderId: number;
  number: number;
  status: OrderStatus;
  deliveryMethod: DeliveryMethod;
  subtotalMinor: number;
  discountMinor: number;
  deliveryCostMinor: number;
  totalMinor: number;
  giftName: string | null;
  contactUsername: string;
  customer: { telegramId: string; username: string | null; firstName: string };
  items: { productName: string; variantName: string; qty: number; unitPriceMinor: number }[];
}

export type OutboxEvent =
  | { type: 'order.created'; payload: OrderNotificationSnapshot }
  | { type: 'order.status_changed'; payload: OrderNotificationSnapshot };

export type OutboxEventType = OutboxEvent['type'];

import type { OrderStatus } from '../constants.js';

const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PROCESSING: ['HANDED_TO_COURIER', 'CANCELLED'],
  HANDED_TO_COURIER: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function nextStatuses(from: OrderStatus): readonly OrderStatus[] {
  return TRANSITIONS[from];
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isFinalStatus(status: OrderStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

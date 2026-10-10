import { ORDER_STATUS_LABELS, type OrderStatus } from '@vapehard/shared';

const STYLES: Record<OrderStatus, string> = {
  PROCESSING: 'bg-amber-950 text-amber-300 border-amber-800',
  HANDED_TO_COURIER: 'bg-blue-950 text-blue-300 border-blue-800',
  COMPLETED: 'bg-emerald-950 text-emerald-300 border-emerald-800',
  CANCELLED: 'bg-red-950 text-red-300 border-red-800',
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 text-xs font-bold whitespace-nowrap ${STYLES[status]}`}
    >
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}

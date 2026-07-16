type OrderStatus =
  | 'pending'
  | 'paid'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

/**
 * Human-readable labels for each order status.
 *
 * Kept in util so both UI components and feature pages can share
 * the same copy without duplicating strings.
 */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: '待支付',
  paid: '已支付',
  processing: '处理中',
  shipped: '已发货',
  delivered: '已送达',
  cancelled: '已取消',
  refunded: '已退款',
};

/**
 * Ordered list of statuses for dropdowns, filters, and timelines.
 *
 * Presents statuses in the typical e-commerce lifecycle order.
 */
export const ORDER_STATUSES: Array<{ value: OrderStatus; label: string }> = [
  { value: 'pending', label: ORDER_STATUS_LABELS.pending },
  { value: 'paid', label: ORDER_STATUS_LABELS.paid },
  { value: 'processing', label: ORDER_STATUS_LABELS.processing },
  { value: 'shipped', label: ORDER_STATUS_LABELS.shipped },
  { value: 'delivered', label: ORDER_STATUS_LABELS.delivered },
  { value: 'cancelled', label: ORDER_STATUS_LABELS.cancelled },
  { value: 'refunded', label: ORDER_STATUS_LABELS.refunded },
];

/**
 * Terminal statuses — once reached, the order lifecycle is complete.
 *
 * Used by the timeline component to decide whether to show
 * an "order closed" footer.
 */
export const ORDER_TERMINAL_STATUSES: readonly OrderStatus[] = [
  'delivered',
  'cancelled',
  'refunded',
] as const;

/**
 * Check whether a given status is terminal.
 */
export function isTerminalStatus(status: OrderStatus): boolean {
  return ORDER_TERMINAL_STATUSES.includes(status);
}

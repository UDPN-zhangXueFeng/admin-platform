import { ORDER_STATUS_LABELS } from './order-status';

type OrderStatus =
  | 'pending'
  | 'paid'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

interface Order {
  id: string;
  orderNo: string;
  customer: string;
  totalAmount: number;
  status: OrderStatus;
  createdAt: string;
  customerEmail?: string;
  customerPhone?: string;
  shippingAddress?: string;
  itemCount?: number;
  currency?: string;
}

export interface TimelineEvent {
  id: string;
  status: OrderStatus;
  label: string;
  timestamp: string;
  description?: string;
}

/**
 * Derive a deterministic timeline from an order's current state.
 *
 * In a real system these events would come from an audit log.
 * Here we synthesise plausible timestamps working backwards
 * from `createdAt` so the timeline always renders something
 * meaningful for demo / dev purposes.
 */
export function getOrderTimelineEvents(order: Order): TimelineEvent[] {
  const created = new Date(order.createdAt);
  const events: TimelineEvent[] = [];

  const add = (status: OrderStatus, minutesOffset: number, description?: string) => {
    const ts = new Date(created.getTime() + minutesOffset * 60_000);
    events.push({
      id: `${order.id}-${status}`,
      status,
      label: ORDER_STATUS_LABELS[status],
      timestamp: ts.toISOString(),
      description,
    });
  };

  // Every order starts at pending
  add('pending', 0, '订单已提交，等待支付');

  // Synthesise forward progression based on current status
  switch (order.status) {
    case 'paid':
    case 'processing':
    case 'shipped':
    case 'delivered':
      add('paid', 5, '支付成功');
      break;
    case 'cancelled':
      add('cancelled', 10, '订单已取消');
      return events;
    case 'refunded':
      add('paid', 5, '支付成功');
      add('refunded', 60, '退款已处理');
      return events;
    default:
      break;
  }

  if (order.status === 'processing' || order.status === 'shipped' || order.status === 'delivered') {
    add('processing', 30, '仓库正在配货');
  }

  if (order.status === 'shipped' || order.status === 'delivered') {
    add('shipped', 120, '快递已揽收');
  }

  if (order.status === 'delivered') {
    add('delivered', 2880, '商品已签收');
  }

  return events;
}

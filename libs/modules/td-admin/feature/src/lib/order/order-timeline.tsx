'use client';

import { Timeline, type TimelineItem } from '@myorg/shared/ui';
import { formatAdminTimestamp } from '../format-admin-time';
type OrderStatus =
  | 'pending'
  | 'paid'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export interface TimelineEvent {
  id: string;
  status: OrderStatus;
  label: string;
  timestamp: string;
  description?: string;
}

export interface OrderTimelineProps {
  events: TimelineEvent[];
  /** The most recent (current) status */
  currentStatus: OrderStatus;
  className?: string;
}

const terminalStatuses: OrderStatus[] = ['delivered', 'cancelled', 'refunded'];

/** Vertical timeline visualising an order's lifecycle. */
export function OrderTimeline({
  events,
  currentStatus,
  className,
}: OrderTimelineProps) {
  const currentIndex = events.findIndex((e) => e.status === currentStatus);
  const isTerminal = terminalStatuses.includes(currentStatus);
  const items: TimelineItem[] = events.map((event, index) => ({
    key: event.id,
    title: event.label,
    meta: formatAdminTimestamp(event.timestamp),
    description: event.description,
    status:
      index < currentIndex
        ? 'complete'
        : index > currentIndex
          ? 'upcoming'
          : currentStatus === 'cancelled' || currentStatus === 'refunded'
            ? 'error'
            : currentStatus === 'delivered'
              ? 'complete'
              : 'current',
  }));

  return (
    <div>
      <Timeline items={items} className={className} />

      {isTerminal && (
        <div className="mt-2 text-xs text-muted-foreground">
          订单已结束
        </div>
      )}
    </div>
  );
}

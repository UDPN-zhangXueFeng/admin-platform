'use client';

import * as React from 'react';
import { cn } from '@myorg/shared/util-classnames';
import { Check, Circle, X, Package, Truck, RotateCcw } from 'lucide-react';
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

const statusIconMap: Record<OrderStatus, React.ReactNode> = {
  pending: <Circle className="h-4 w-4" />,
  paid: <Check className="h-4 w-4" />,
  processing: <Package className="h-4 w-4" />,
  shipped: <Truck className="h-4 w-4" />,
  delivered: <Check className="h-4 w-4" />,
  cancelled: <X className="h-4 w-4" />,
  refunded: <RotateCcw className="h-4 w-4" />,
};

const terminalStatuses: OrderStatus[] = ['delivered', 'cancelled', 'refunded'];

/**
 * Vertical timeline visualising an order's lifecycle.
 *
 * Events are rendered top-to-bottom. The event matching
 * `currentStatus` is highlighted; earlier events are shown
 * as completed. Terminal statuses (delivered / cancelled /
 * refunded) suppress the pending connector line.
 */
export function OrderTimeline({
  events,
  currentStatus,
  className,
}: OrderTimelineProps) {
  const isTerminal = terminalStatuses.includes(currentStatus);

  return (
    <div className={cn('relative pl-4', className)}>
      <ol className="space-y-0">
        {events.map((event, index) => {
          const isActive = event.status === currentStatus;
          const isPast =
            events.findIndex((e) => e.status === currentStatus) > index;
          const isLast = index === events.length - 1;

          return (
            <li key={event.id} className="relative pb-8 last:pb-0">
              {/* Connector line */}
              {!isLast && (
                <span
                  className={cn(
                    'absolute left-[11px] top-6 h-full w-px',
                    isPast || isActive
                      ? 'bg-primary'
                      : 'bg-border'
                  )}
                  aria-hidden="true"
                />
              )}

              <div className="flex items-start gap-3">
                {/* Icon bubble */}
                <div
                  className={cn(
                    'relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2',
                    isActive
                      ? 'border-primary bg-primary text-primary-foreground'
                      : isPast
                        ? 'border-primary bg-background text-primary'
                        : 'border-border bg-background text-muted-foreground'
                  )}
                >
                  {statusIconMap[event.status]}
                </div>

                {/* Text content */}
                <div className="flex flex-col gap-0.5">
                  <span
                    className={cn(
                      'text-sm font-medium',
                      isActive
                        ? 'text-foreground'
                        : isPast
                          ? 'text-foreground'
                          : 'text-muted-foreground'
                    )}
                  >
                    {event.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {event.timestamp}
                  </span>
                  {event.description ? (
                    <span className="text-xs text-muted-foreground">
                      {event.description}
                    </span>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {isTerminal && (
        <div className="mt-2 text-xs text-muted-foreground">
          订单已结束
        </div>
      )}
    </div>
  );
}

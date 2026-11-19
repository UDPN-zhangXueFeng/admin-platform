'use client';

import * as React from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@myorg/shared/util-classnames';

export type TimelineItemStatus = 'complete' | 'current' | 'upcoming' | 'neutral' | 'error';

export interface TimelineItem {
  key?: React.Key;
  title: React.ReactNode;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  status?: TimelineItemStatus;
}

export interface TimelineProps {
  items: readonly TimelineItem[];
  ariaLabel?: string;
  className?: string;
}

/**
 * Vertical workflow timeline.
 *
 * Layout invariant: `pb-6` lives on the content column, never on `<li>`, so the
 * rail column (`flex-1` connector) stretches through the inter-item gap and the
 * connector meets the next node exactly. Nodes must not carry top margins.
 *
 * Status semantics: `complete` = done (check), `current` = active (ring + dot),
 * `error` = failed (X), `neutral` = static/definition node (small dot),
 * `upcoming` = not reached (empty ring).
 */
export function Timeline({ items, ariaLabel, className }: TimelineProps): React.JSX.Element {
  return (
    <ol aria-label={ariaLabel} className={cn('flex flex-col', className)}>
      {items.map((item, index) => {
        const status = item.status ?? 'upcoming';
        const isLast = index === items.length - 1;
        return (
          <li key={item.key ?? index} className="flex gap-3" aria-current={status === 'current' ? 'step' : undefined}>
            <div className="flex w-5 shrink-0 flex-col items-center">
              <span
                aria-hidden="true"
                data-timeline-node={status}
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full border-2',
                  status === 'complete' && 'border-primary bg-primary text-primary-foreground',
                  status === 'current' && 'border-primary bg-card text-primary ring-4 ring-primary/15',
                  status === 'error' && 'border-destructive bg-destructive text-destructive-foreground',
                  status === 'neutral' && 'border-border bg-card text-muted-foreground',
                  status === 'upcoming' && 'border-border bg-card',
                )}
              >
                {status === 'complete' && <Check className="size-3" strokeWidth={3} />}
                {status === 'current' && <span className="size-2 rounded-full bg-primary" />}
                {status === 'error' && <X className="size-3" strokeWidth={3} />}
                {status === 'neutral' && <span className="size-1.5 rounded-full bg-muted-foreground/60" />}
              </span>
              {!isLast && (
                <span aria-hidden="true" data-timeline-connector className={cn('mt-1 w-px flex-1', status === 'complete' ? 'bg-primary/30' : 'bg-border')} />
              )}
            </div>
            <div className={cn('min-w-0 flex-1', !isLast && 'pb-6')}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <div className={cn('text-sm font-medium leading-5', status === 'error' ? 'text-destructive' : 'text-foreground')}>{item.title}</div>
                {item.meta != null && <div className="shrink-0 text-xs tabular-nums text-muted-foreground">{item.meta}</div>}
              </div>
              {item.description != null && <div className="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

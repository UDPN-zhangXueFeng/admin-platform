'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@myorg/shared/util-classnames';
import type { VerificationStatus } from '@myorg/modules/travel-rule/util';

const statusVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      status: {
        Pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
        Verified: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
        Rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      } as Record<VerificationStatus, string>,
    },
    defaultVariants: {
      status: 'Pending',
    },
  }
);

export interface TravelRuleStatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusVariants> {
  status: VerificationStatus;
  /** Override the default label. Useful for i18n. */
  label?: string;
}

/**
 * Verification-status badge for Travel Rule records.
 *
 * CVA-driven colour variants that adapt to dark mode:
 *   Pending → warning (amber), Verified → success (green), Rejected → error (red).
 * The default label is the status string itself; pass `label` to localise.
 */
export function TravelRuleStatusBadge({
  status,
  label,
  className,
  ...props
}: TravelRuleStatusBadgeProps) {
  return (
    <span className={cn(statusVariants({ status }), className)} {...props}>
      {label ?? status}
    </span>
  );
}

'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@myorg/shared/util-classnames';
import type { ProductStatus } from '@myorg/modules/product/util';

const statusVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      status: {
        active:
          'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
        inactive:
          'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
        pending:
          'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      } as Record<ProductStatus, string>,
    },
    defaultVariants: {
      status: 'pending',
    },
  },
);

export interface ProductStatusBadgeProps
  extends VariantProps<typeof statusVariants> {
  status: ProductStatus;
  className?: string;
}

/**
 * Visual status badge for 商品管理 entities.
 *
 * Maps each ProductStatus to a colour-coded pill. Dark-mode colours
 * are included so the badge works across themes without extra props.
 */
export function ProductStatusBadge({
  status,
  className,
}: ProductStatusBadgeProps) {
  const labels: Record<ProductStatus, string> = {
    active: 'Active',
    inactive: 'Inactive',
    pending: 'Pending',
  };

  return (
    <span className={cn(statusVariants({ status }), className)}>
      {labels[status]}
    </span>
  );
}

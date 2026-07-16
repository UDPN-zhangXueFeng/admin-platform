'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@myorg/shared/util-classnames';
type OrderStatus =
  | 'pending'
  | 'paid'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

const statusVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      status: {
        pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
        paid: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
        processing: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
        shipped: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
        delivered: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
        cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
        refunded: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
      } as Record<OrderStatus, string>,
    },
    defaultVariants: {
      status: 'pending',
    },
  }
);

const statusLabelMap: Record<OrderStatus, string> = {
  pending: '待支付',
  paid: '已支付',
  processing: '处理中',
  shipped: '已发货',
  delivered: '已送达',
  cancelled: '已取消',
  refunded: '已退款',
};

export interface OrderStatusTagProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusVariants> {
  status: OrderStatus;
  /** Override the default label. Useful for i18n. */
  label?: string;
}

/**
 * Order status badge with CVA-driven colour variants.
 *
 * Colours are semantic and adapt to dark mode via Tailwind
 * `dark:` prefixes. The label defaults to Chinese copy but can
 * be overridden per-locale.
 */
export function OrderStatusTag({
  status,
  label,
  className,
  ...props
}: OrderStatusTagProps) {
  return (
    <span
      className={cn(statusVariants({ status }), className)}
      {...props}
    >
      {label ?? statusLabelMap[status]}
    </span>
  );
}

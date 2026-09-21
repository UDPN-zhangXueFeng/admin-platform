'use client';

import * as React from 'react';
import { cn } from '@myorg/shared/util-classnames';
import { ShoppingCart, Users, Package, TrendingUp } from 'lucide-react';

export interface OrderSummaryCardProps {
  /** Metric value — can be a number or formatted string */
  value: string | number;
  /** Short label below the value */
  label: string;
  /** Lucide icon name rendered as a small badge */
  icon: React.ReactNode;
  /** Optional change indicator, e.g. "+12%" or "-5%" */
  change?: string;
  /** Whether the change is positive (green) or negative (red) */
  changePositive?: boolean;
  className?: string;
}

/**
 * Compact summary card for order-related KPIs.
 *
 * Used in dashboards or list-page header areas to surface
 * high-level metrics (total orders, revenue, active customers).
 */
export function OrderSummaryCard({
  value,
  label,
  icon,
  change,
  changePositive = true,
  className,
}: OrderSummaryCardProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-4 rounded-lg border bg-card p-4 text-card-foreground shadow-sm',
        className
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="flex flex-col">
        <span className="text-lg font-semibold leading-none">{value}</span>
        <span className="mt-1 text-xs text-muted-foreground">{label}</span>
        {change ? (
          <span
            className={cn(
              'mt-0.5 text-xs font-medium',
              changePositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            )}
          >
            {change}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** Pre-configured summary cards for the order list header. */
export function OrderSummaryCards({
  totalOrders,
  totalRevenue,
  activeCustomers,
  pendingOrders,
  className,
}: {
  totalOrders: number;
  totalRevenue: string;
  activeCustomers: number;
  pendingOrders: number;
  className?: string;
}) {
  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-4', className)}>
      <OrderSummaryCard
        value={totalOrders}
        label="总订单数"
        icon={<ShoppingCart className="h-5 w-5" />}
        change="+8.2%"
        changePositive
      />
      <OrderSummaryCard
        value={totalRevenue}
        label="总营收"
        icon={<TrendingUp className="h-5 w-5" />}
        change="+12.5%"
        changePositive
      />
      <OrderSummaryCard
        value={activeCustomers}
        label="活跃客户"
        icon={<Users className="h-5 w-5" />}
        change="+3.1%"
        changePositive
      />
      <OrderSummaryCard
        value={pendingOrders}
        label="待处理订单"
        icon={<Package className="h-5 w-5" />}
        change="-2.4%"
        changePositive={false}
      />
    </div>
  );
}

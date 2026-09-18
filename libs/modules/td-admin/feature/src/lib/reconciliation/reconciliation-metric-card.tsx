'use client';

import * as React from 'react';
import { Card, CardContent } from '@myorg/shared/ui';
import { cn } from '@myorg/shared/util-classnames';

export interface ReconciliationMetricCardProps {
  label: React.ReactNode;
  value: React.ReactNode;
  icon?: React.ReactNode;
  extra?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}

/**
 * 指标卡（Matched/Unmatched/Actioned/Exceptions），迁移自旧
 * `ReconciliationMetricCard`。real-time 详情用 3 卡，reserve 详情用 2 卡。
 */
export function ReconciliationMetricCard({
  label,
  value,
  icon,
  extra,
  className,
  bodyClassName,
}: ReconciliationMetricCardProps) {
  return (
    <Card className={cn('flex-1', className)}>
      <CardContent
        className={cn(
          'flex items-center justify-between gap-3 py-4',
          bodyClassName,
        )}
      >
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className="text-xl font-semibold tabular-nums">{value}</span>
        </div>
        <div className="flex items-center gap-2">
          {icon && <span className="text-muted-foreground">{icon}</span>}
          {extra && (
            <span className="text-xs text-muted-foreground">{extra}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

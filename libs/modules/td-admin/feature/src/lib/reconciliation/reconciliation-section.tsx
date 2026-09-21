'use client';

import * as React from 'react';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@myorg/shared/ui';
import { cn } from '@myorg/shared/util-classnames';

export interface ReconciliationSectionProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  extra?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

/**
 * 详情页白底圆角 section（迁移自旧 `ReconciliationSection`）。
 * real-time/reserve 详情页基本信息 + 各分区通用容器。
 */
export function ReconciliationSection({
  title,
  description,
  extra,
  children,
  className,
}: ReconciliationSectionProps) {
  return (
    <Card className={cn('gap-0', className)}>
      {(title || extra) && (
        <CardHeader>
          <div className="flex flex-col gap-1">
            {title && <CardTitle>{title}</CardTitle>}
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          {extra && <CardAction>{extra}</CardAction>}
        </CardHeader>
      )}
      <CardContent className="py-4">{children}</CardContent>
    </Card>
  );
}

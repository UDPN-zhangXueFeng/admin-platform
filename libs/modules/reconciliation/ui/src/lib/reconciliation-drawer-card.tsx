'use client';

import * as React from 'react';
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@myorg/shared/ui';
import { cn } from '@myorg/shared/util-classnames';

export interface ReconciliationDrawerCardProps {
  title?: React.ReactNode;
  extra?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Drawer 内带 title/extra 的 Card（4 个 Modal 顶部 Recon Info 区块）。
 * 迁移自旧 `ReconciliationDrawerCard`。
 */
export function ReconciliationDrawerCard({
  title,
  extra,
  children,
  className,
}: ReconciliationDrawerCardProps) {
  return (
    <Card className={cn('gap-0', className)}>
      {(title || extra) && (
        <CardHeader className="py-3">
          {title && <CardTitle className="text-sm">{title}</CardTitle>}
          {extra && <CardAction>{extra}</CardAction>}
        </CardHeader>
      )}
      <CardContent className="py-3">{children}</CardContent>
    </Card>
  );
}

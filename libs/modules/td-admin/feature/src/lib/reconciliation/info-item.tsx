'use client';

import * as React from 'react';
import { cn } from '@myorg/shared/util-classnames';

export interface InfoItemProps {
  label: React.ReactNode;
  children?: React.ReactNode;
  /** Alias for children — convenience for `<InfoItem label={...} value={...} />` */
  value?: React.ReactNode;
  className?: string;
}

/**
 * KV grid 项：label 灰 + value 黑（DrawerCard / Section 内网格单元）。
 * 迁移自旧 4 个 Modal 内重复定义的 `InfoItem`，收敛为模块 ui 层共享。
 */
export function InfoItem({ label, children, value, className }: InfoItemProps) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm break-all text-foreground">{children ?? value}</span>
    </div>
  );
}

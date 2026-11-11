'use client';

import * as React from 'react';
import { cn } from '@myorg/shared/util-classnames';

/**
 * DetailGrid —— 详情字段栅格（移动单列 → 640px 起两列）。
 *
 * 根节点为 `<dl>`，与 DetailField 的 `<dt>`/`<dd>` 配套；字段的 `span`
 * 通过 `sm:col-span-full` 独占一行，`className` 可整体改写列布局。
 */
export interface DetailGridProps {
  className?: string;
  children: React.ReactNode;
}

export function DetailGrid({ className, children }: DetailGridProps) {
  return (
    <dl
      className={cn(
        'grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2',
        className,
      )}
    >
      {children}
    </dl>
  );
}

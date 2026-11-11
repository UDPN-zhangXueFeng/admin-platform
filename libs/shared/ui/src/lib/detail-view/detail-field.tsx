'use client';

import * as React from 'react';
import { cn } from '@myorg/shared/util-classnames';

/**
 * DetailField —— 只读详情字段（`dt` 标签上置、`dd` 值下置）。
 *
 * 空值统一渲染 `--`（仅 null/undefined/空字符串；数字 0 照常渲染，不做真值
 * 强转）。`muted` 用于审计条等次要信息；`span="full"` 独占整行。
 */
export interface DetailFieldProps {
  label: string;
  value?: React.ReactNode;
  span?: 1 | 'full';
  muted?: boolean;
}

const SPAN_CLASS: Record<1 | 'full', string> = {
  1: '',
  full: 'sm:col-span-full',
};

export function DetailField({
  label,
  value,
  span = 1,
  muted = false,
}: DetailFieldProps) {
  const isEmpty = value === null || value === undefined || value === '';

  return (
    <div className={cn('min-w-0', SPAN_CLASS[span])}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          'm-0 mt-1 min-w-0 break-words text-sm leading-relaxed',
          muted && 'text-xs text-foreground/80',
        )}
      >
        {isEmpty ? '--' : value}
      </dd>
    </div>
  );
}

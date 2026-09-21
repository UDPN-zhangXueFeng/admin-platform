'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@myorg/shared/util-classnames';

/** 状态视觉语调（替代源项目 antd `Tag` 的 success/default 配色）。 */
export type ChartOfAccountsStatusTone = 'active' | 'inactive' | 'default';

const statusToneVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      tone: {
        active:
          'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
        inactive:
          'bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-300',
        default:
          'bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-300',
      },
    },
    defaultVariants: {
      tone: 'default',
    },
  }
);

export interface ChartOfAccountsStatusTagProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusToneVariants> {
  /** 视觉语调，由调用方根据 status / statusName 解析后传入。 */
  tone: ChartOfAccountsStatusTone;
  /** 展示文案（已本地化）。 */
  label: string;
}

/**
 * Chart of Accounts 行状态标签。
 *
 * 仅负责呈现，不承担状态码解析逻辑（解析在 feature 层，依据自适应推断的
 * active/inactive 码）。`label` 由调用方本地化后传入。
 */
export function ChartOfAccountsStatusTag({
  tone,
  label,
  className,
  ...props
}: ChartOfAccountsStatusTagProps) {
  return (
    <span className={cn(statusToneVariants({ tone }), className)} {...props}>
      {label}
    </span>
  );
}

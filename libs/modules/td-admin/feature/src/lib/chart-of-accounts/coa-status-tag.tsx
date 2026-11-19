'use client';

import * as React from 'react';
import { Badge } from '@myorg/shared/ui';
import { cn } from '@myorg/shared/util-classnames';

/** 状态视觉语调（替代源项目 antd `Tag` 的 success/default 配色）。 */
export type ChartOfAccountsStatusTone = 'active' | 'inactive' | 'default';

/**
 * 色调 → 边框/底色/文字 class，取值对齐 Normalization Engine 的
 * `statusToneClass`（active = green-50/700/200，其余 = gray-50/600/200），
 * 保证会计模块各列表的状态标签颜色一致。
 */
const TONE_CLASS: Record<ChartOfAccountsStatusTone, string> = {
  active: 'border-green-200 bg-green-50 text-green-700',
  inactive: 'border-gray-200 bg-gray-50 text-gray-600',
  default: 'border-gray-200 bg-gray-50 text-gray-600',
};

export interface ChartOfAccountsStatusTagProps
  extends React.ComponentProps<'span'> {
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
 *
 * 基于共享 `Badge` 实现，`dot` 同时给出形状线索，状态不会只靠颜色表达；
 * 边框/底色/文字与 Normalization Engine 的状态标签保持一致。
 */
export function ChartOfAccountsStatusTag({
  tone,
  label,
  className,
  ...props
}: ChartOfAccountsStatusTagProps) {
  return (
    <Badge
      variant="outline"
      dot
      className={cn(TONE_CLASS[tone] ?? TONE_CLASS.default, className)}
      {...props}
    >
      {label}
    </Badge>
  );
}

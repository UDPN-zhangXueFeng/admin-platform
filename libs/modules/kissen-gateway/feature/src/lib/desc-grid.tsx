'use client';

/**
 * 详情描述网格/字段（el-descriptions 的 React 等价）。
 *
 * 由 market/role/tx/user/onboard 各页面本地副本收敛；variant 精确对应
 * 迁移期既存的三组样式（渲染输出与收敛前逐字节一致）：
 * - dl：market/role/tx 的 dt/dd 字段（默认）。
 * - plain：user 详情的 DetailField（div 结构 + tabular-nums）。
 * - boxed：onboard 银行信息卡的描边盒字段（支持 span 跨两列）。
 *
 * DescGrid 默认响应式阶梯 grid-cols-1 → sm:2 → lg:3 → xl:4
 * （P0 唯一有意视觉变更，任务批准）；cols 指定列数上限时阶梯截止
 * 到该档（cols={2} 即原 market/role/tx 的两列语义）；className 透传追加。
 */
import type * as React from 'react';

import { cn } from '@myorg/shared/util-classnames';

/** 各档列数对应的响应式阶梯（类名须完整字面量，Tailwind JIT 才会生成）。 */
const DESC_GRID_COLS = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
} as const;

export function DescGrid({
  cols = 4,
  className,
  children,
}: {
  /** 响应式阶梯截止的列数上限；默认 4（完整阶梯）。 */
  cols?: 1 | 2 | 3 | 4;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <dl className={cn('grid gap-x-4 gap-y-3', DESC_GRID_COLS[cols], className)}>
      {children}
    </dl>
  );
}

export function DescField({
  label,
  span = false,
  variant = 'dl',
  children,
}: {
  label: string;
  /** 仅 boxed 变体生效：自 sm 断点起跨满两列。 */
  span?: boolean;
  variant?: 'dl' | 'plain' | 'boxed';
  children: React.ReactNode;
}) {
  if (variant === 'boxed') {
    return (
      <div className={cn('space-y-1.5 rounded-md border px-4 py-3', span && 'sm:col-span-2')}>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm tabular-nums">{children}</div>
      </div>
    );
  }
  if (variant === 'plain') {
    return (
      <div className="space-y-1.5">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm tabular-nums">{children}</div>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

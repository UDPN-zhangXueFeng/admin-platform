import * as React from 'react';

import { cn } from '@myorg/shared/util-classnames';

/**
 * Skeleton — placeholder block for loading states (`animate-pulse`, motion-safe).
 *
 * 结构化建议（骨架要映射真实内容结构，不要用一大块矩形糊弄）：
 * - 文本行：宽窄交错，最后一行约 60% 宽 —— `<Skeleton className="h-4 w-3/5" />`
 * - 头像/图标位：圆形 —— `<Skeleton className="h-10 w-10 rounded-full" />`
 * - 卡片/面板：先容器后内容，行高对齐真实行高（h-4≈一行 sm 文本）
 * - 表格：每行一个 flex 容器内放若干 `h-4` 骨架，列宽与真实列对齐
 * 组合时外层用 `space-y-2`/`flex items-center gap-3` 控制节奏。
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('motion-safe:animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  );
}

export { Skeleton };

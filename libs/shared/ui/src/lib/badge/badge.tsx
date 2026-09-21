'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@myorg/shared/util-classnames';

/**
 * Badge —— 小徽标（shadcn 风，Tailwind v3，原生 span）。
 *
 * 迁移自 tokenized-deposit-redesign 的 badge.tsx（v4/base-ui `useRender`），
 * 改写为纯 span + cva，去掉 base-ui 依赖。
 *
 * 状态语义（纲领 §5.4）：success=已完成/健康 · warning=待处理/临界 ·
 * info=处理中/说明 · destructive=失败/破坏性 · mute=中性弱化。
 * soft 档底色 10%（暗色 20%）+ 语义前景色；token 值经 P1 对比度实测锁定（≥4.5:1）。
 * `dot` 提供形状维度，状态表达不单独依赖颜色。
 * 尺寸两档与正文 12px 下限对齐：default h-5 / sm h-4（密集表格行）。
 */
const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-full border border-transparent text-xs font-medium whitespace-nowrap tabular-nums motion-safe:transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        secondary: 'bg-secondary text-secondary-foreground',
        destructive:
          'bg-destructive/10 text-destructive dark:bg-destructive/20',
        success: 'bg-success/10 text-success dark:bg-success/20',
        warning: 'bg-warning/10 text-warning dark:bg-warning/20',
        info: 'bg-info/10 text-info dark:bg-info/20',
        mute: 'bg-muted text-muted-foreground',
        outline: 'border-border text-foreground',
        ghost: 'text-muted-foreground hover:bg-muted',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-5 px-2',
        sm: 'h-4 px-1.5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface BadgeProps
  extends React.ComponentProps<'span'>,
    VariantProps<typeof badgeVariants> {
  /** Prepends a currentColor status dot (shape cue, so status is never color-only). */
  dot?: boolean;
}

function Badge({
  className,
  variant,
  size,
  dot = false,
  children,
  ...props
}: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot ? (
        <span
          aria-hidden="true"
          className="size-1.5 shrink-0 rounded-full bg-current"
        />
      ) : null}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };

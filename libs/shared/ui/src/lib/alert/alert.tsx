'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@myorg/shared/util-classnames';

/**
 * Alert —— 内联提示框（shadcn 风，Tailwind v3）。
 *
 * 四语义 variant 齐备：default / success / warning / info / destructive。
 * 语义变体统一「浅底 + 同色系 30% 边框 + 标题同色」：正文保持可读的
 * 前景色，颜色信号由边框、底色与标题承载；图标由调用方传入（lucide，
 * 自带 size，颜色继承标题色）。
 */
const alertVariants = cva(
  'flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm [&_svg]:mt-0.5 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-card text-card-foreground',
        success: 'border-success/30 bg-success/5 text-success',
        warning: 'border-warning/30 bg-warning/5 text-warning',
        info: 'border-info/30 bg-info/5 text-info',
        destructive: 'border-destructive/30 bg-destructive/5 text-destructive',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface AlertProps
  extends React.ComponentProps<'div'>,
    VariantProps<typeof alertVariants> {}

function Alert({ className, variant = 'default', ...props }: AlertProps) {
  return (
    <div
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('font-medium leading-snug', className)}
      {...props}
    />
  );
}

function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription };

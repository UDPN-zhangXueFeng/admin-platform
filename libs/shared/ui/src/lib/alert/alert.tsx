'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@myorg/shared/util-classnames';

/**
 * Alert —— 内联提示框（shadcn 风，Tailwind v3）。
 *
 * 迁移自 tokenized-deposit-redesign 的 alert.tsx，简化 v4 `has-[>svg]`/`*:[svg]`
 * 选择器为稳健的 flex 布局；图标由调用方传入（lucide，自带 size）。
 */
const alertVariants = cva(
  'flex w-full items-start gap-2 rounded-lg border px-3 py-2.5 text-left text-sm',
  {
    variants: {
      variant: {
        default: 'bg-card text-card-foreground',
        destructive: 'bg-card text-destructive',
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

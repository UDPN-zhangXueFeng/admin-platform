'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@myorg/shared/util-classnames';

/**
 * Badge —— 小徽标（shadcn 风，Tailwind v3，原生 span）。
 *
 * 迁移自 tokenized-deposit-redesign 的 badge.tsx（v4/base-ui `useRender`），
 * 改写为纯 span + cva，去掉 base-ui 依赖。
 */
const badgeVariants = cva(
  'inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        secondary: 'bg-secondary text-secondary-foreground',
        destructive:
          'bg-destructive/10 text-destructive dark:bg-destructive/20',
        outline:
          'border-border text-foreground',
        ghost: 'text-muted-foreground hover:bg-muted',
        link: 'text-primary underline-offset-4 hover:underline',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.ComponentProps<'span'>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };

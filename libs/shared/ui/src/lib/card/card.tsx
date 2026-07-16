'use client';

import * as React from 'react';
import { cn } from '@myorg/shared/util-classnames';

/**
 * Card —— 容器卡片（shadcn 风，Tailwind v3 + 原生 div）。
 *
 * 迁移自 tokenized-deposit-redesign 的 Card（v4/base-ui 版），改写为 v3 兼容：
 * 去掉 v4 spacing 变量(`--card-spacing`/`--spacing()`)与 `data-slot` 选择器，
 * padding 由 CardHeader/Content/Footer 各自的默认值或调用方 className 控制。
 */
function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm',
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 px-6 py-5',
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('text-base font-medium leading-snug', className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div className={cn('text-sm text-muted-foreground', className)} {...props} />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex shrink-0 items-center gap-2', className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('px-6', className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex items-center border-t bg-muted/40 px-6 py-4',
        className,
      )}
      {...props}
    />
  );
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
};

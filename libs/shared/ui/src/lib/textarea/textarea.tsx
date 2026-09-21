'use client';

import * as React from 'react';
import { cn } from '@myorg/shared/util-classnames';

/**
 * Textarea —— 多行文本框（shadcn 风，Tailwind v3）。
 *
 * 与 Input 视觉一致（border-input/bg-background/ring-ring），替代各处手写裸
 * textarea 的长 className 串。`aria-invalid` 态描边 destructive。
 */
export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          'flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
          // Placeholder keeps full muted-foreground: /70 = 2.71:1 on light bg — fails 4.5:1
          'placeholder:text-muted-foreground',
          // Edge-hugging focus ring, same as Input; error state via aria-invalid
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          'aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive',
          'motion-safe:transition-colors motion-safe:duration-150',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
    );
  },
);
Textarea.displayName = 'Textarea';

export { Textarea };

'use client';

import * as React from 'react';
import { cn } from '../utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

/**
 * Styled native input.
 *
 * Provides consistent border, focus ring, placeholder colour, file-input
 * styling, and disabled state. Accepts all standard input attributes.
 *
 * Size ladder (override via `className`, merges through tailwind-merge):
 * `h-8` dense (pagination/toolbar), `h-9` filters, default `h-10` forms.
 * Base padding `py-1` keeps every rung vertically centered.
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground',
          // Placeholder keeps full muted-foreground: /70 = 2.71:1, /85 = 3.56:1 on light bg — both fail 4.5:1
          'placeholder:text-muted-foreground',
          // Edge-hugging focus ring (Golden Page pattern); error state via aria-invalid
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          'aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive',
          'motion-safe:transition-colors motion-safe:duration-150',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };

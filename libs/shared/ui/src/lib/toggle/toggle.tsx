'use client';

import * as React from 'react';
import * as TogglePrimitive from '@radix-ui/react-toggle';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@myorg/shared/util-classnames';

/**
 * Size rungs match Button: sm h-9 (filter rows) · default h-10 (form controls) · lg h-11.
 */
const toggleVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium',
    'motion-safe:transition-colors motion-safe:duration-150',
    'hover:bg-muted hover:text-muted-foreground',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'disabled:pointer-events-none disabled:opacity-50',
    'data-[state=on]:bg-accent data-[state=on]:text-accent-foreground',
    '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        outline:
          'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        sm: 'h-9 px-2',
        default: 'h-10 px-3',
        lg: 'h-11 px-3',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ToggleProps
  extends React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root>,
    VariantProps<typeof toggleVariants> {}

/**
 * Two-state button that can be toggled on or off.
 *
 * Built on Radix Toggle with CVA-driven variants matching the
 * design-system conventions (default / outline, sm / default / lg).
 */
const Toggle = React.forwardRef<
  React.ElementRef<typeof TogglePrimitive.Root>,
  ToggleProps
>(({ className, variant, size, ...props }, ref) => (
  <TogglePrimitive.Root
    ref={ref}
    className={cn(toggleVariants({ variant, size, className }))}
    {...props}
  />
));
Toggle.displayName = TogglePrimitive.Root.displayName;

export { Toggle, toggleVariants };

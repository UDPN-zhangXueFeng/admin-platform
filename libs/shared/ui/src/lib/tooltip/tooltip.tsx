'use client';

import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@myorg/shared/util-classnames';

/**
 * Tooltip provider.
 *
 * Wraps your app (or a subtree) so that tooltips can share
 * delay and skip-delay timing. Mount once near the root.
 */
const TooltipProvider = TooltipPrimitive.Provider;

/**
 * Tooltip root. Controls open state and delay.
 */
const Tooltip = TooltipPrimitive.Root;

/**
 * Trigger element that opens the tooltip on hover / focus.
 */
const TooltipTrigger = TooltipPrimitive.Trigger;

/**
 * Tooltip content panel.
 *
 * Renders inside a Radix portal. Includes a small arrow by default.
 * Uses `z-50` to float above most UI layers.
 */
const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      'z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md',
      'motion-safe:animate-in fade-in-0 zoom-in-95 motion-safe:data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
      'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
      className
    )}
    {...props}
  />
));

/**
 * Small arrow pointing from the tooltip panel to its trigger.
 * Compose inside `TooltipContent` when a pointer is wanted.
 */
const TooltipArrow = TooltipPrimitive.Arrow;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, TooltipArrow };

'use client';

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@myorg/shared/util-classnames';

/**
 * Tabs root component.
 *
 * Wraps Radix TabsRoot with no styling changes — consumers control
 * layout via className on the list and content panels.
 */
const Tabs = TabsPrimitive.Root;

/**
 * List container for tab triggers.
 *
 * Underline style: bottom border acts as the track, triggers stretch to
 * full height so their 2px active indicator sits flush on the track.
 * Horizontally scrollable when triggers overflow (scrollbar hidden,
 * shift+wheel / trackpad still works).
 * Add `className` to override spacing or border treatment.
 */
const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex h-10 items-stretch justify-start gap-1 overflow-x-auto border-b border-border text-muted-foreground',
      '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
      className
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

/**
 * Individual tab trigger button.
 *
 * Underline indicator: 2px bar (`after:` pseudo-element) scales in from
 * the left edge over 150ms (micro-interaction band, motion-safe only). Focus
 * uses an inset ring — the list is a scroll port that would clip an offset one.
 * Count badge slot: append a `<span data-count>12</span>` (or a Badge) as
 * the last child — `[&_[data-count]]` styles it as a compact tabular-nums
 * pill; the trigger's `gap-1.5` handles spacing.
 */
const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap px-3 text-sm font-medium',
      'text-muted-foreground hover:text-foreground motion-safe:transition-colors motion-safe:duration-200',
      // Inset ring: the list is an overflow-x-auto scroll port — an offset ring
      // would be clipped on every side (keyboard focus invisible)
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
      'disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-foreground',
      // 2px active indicator, 150ms scale-in (micro-interaction band, motion-safe)
      "after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:origin-left after:rounded-full after:bg-primary after:content-[''] after:scale-x-0",
      'motion-safe:after:transition-transform motion-safe:after:duration-150 motion-safe:after:ease-out',
      'data-[state=active]:after:scale-x-100',
      // Count badge slot (`<span data-count>` as last child)
      '[&_[data-count]]:inline-flex [&_[data-count]]:h-5 [&_[data-count]]:min-w-5 [&_[data-count]]:items-center [&_[data-count]]:justify-center [&_[data-count]]:rounded-full [&_[data-count]]:bg-muted [&_[data-count]]:px-1.5 [&_[data-count]]:text-xs [&_[data-count]]:font-medium [&_[data-count]]:leading-none [&_[data-count]]:tabular-nums [&_[data-count]]:text-muted-foreground',
      'data-[state=active]:[&_[data-count]]:bg-accent data-[state=active]:[&_[data-count]]:text-accent-foreground',
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

/**
 * Content panel for a tab.
 *
 * Only rendered when its associated trigger is active; fades in over
 * 150ms (motion-safe) on activation.
 * Add `className` for padding or layout inside the panel.
 */
const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-2 ring-offset-background',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-150',
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };

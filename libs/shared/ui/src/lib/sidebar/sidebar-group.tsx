'use client';

import * as React from 'react';
import { cn } from '@myorg/shared/util-classnames';

export interface SidebarGroupProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Sidebar group wrapper.
 *
 * Visually groups related navigation items under an optional heading.
 * When the sidebar is collapsed the heading is hidden to save space.
 */
export function SidebarGroup({ title, children, className }: SidebarGroupProps) {
  return (
    <div className={cn('flex flex-col gap-1 py-2', className)}>
      {title && (
        <h3 className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
      )}
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

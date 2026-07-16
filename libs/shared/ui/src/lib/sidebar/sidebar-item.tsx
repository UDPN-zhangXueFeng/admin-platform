'use client';

import * as React from 'react';
import { usePathname } from '@myorg/shared/util-i18n';
import Link from 'next/link';
import { LucideIcon } from 'lucide-react';
import { cn } from '@myorg/shared/util-classnames';

export interface SidebarItemProps {
  id: string;
  icon: LucideIcon;
  label: string;
  path: string;
  collapsed: boolean;
  disabled?: boolean;
}

/**
 * Individual sidebar menu item.
 *
 * Renders an icon + label, highlights when active (matched via usePathname),
 * and shows a tooltip when the sidebar is collapsed.
 *
 * Keyboard navigation: the underlying <Link> is focusable and participates
 * in the browser's natural tab order. We add `aria-current="page"` for
 * active-state announcements.
 */
export function SidebarItem({
  icon: Icon,
  label,
  path,
  collapsed,
  disabled = false,
}: SidebarItemProps) {
  const pathname = usePathname();
  const isActive = pathname === path || pathname?.startsWith(`${path}/`);

  const content = (
    <Link
      href={disabled ? '#' : path}
      aria-current={isActive ? 'page' : undefined}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      className={cn(
        'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        isActive
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        disabled && 'pointer-events-none opacity-50',
        collapsed && 'justify-center px-2'
      )}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );

  if (collapsed) {
    return (
      <div className="relative flex justify-center">
        {content}
        {/* Simple CSS-only tooltip for collapsed state */}
        <span
          className={cn(
            'pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2',
            'rounded-md bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md',
            'opacity-0 transition-opacity group-hover:opacity-100',
            'whitespace-nowrap border'
          )}
          role="tooltip"
        >
          {label}
        </span>
      </div>
    );
  }

  return content;
}

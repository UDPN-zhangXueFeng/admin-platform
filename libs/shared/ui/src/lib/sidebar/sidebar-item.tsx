'use client';

import * as React from 'react';
import { usePathname } from '@myorg/shared/util-i18n';
import Link from 'next/link';
import { LucideIcon } from 'lucide-react';
import { cn } from '@myorg/shared/util-classnames';
import { SidebarActiveBackdrop } from './sidebar-active-backdrop';

export interface SidebarItemProps {
  id: string;
  icon: LucideIcon;
  label: string;
  path: string;
  collapsed: boolean;
  disabled?: boolean;
  /** Child entries follow the reference sidebar's compact text-only treatment. */
  nested?: boolean;
  onClick?: () => void;
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
  nested = false,
  onClick,
}: SidebarItemProps) {
  const pathname = usePathname();
  const isActive = pathname === path || pathname?.startsWith(`${path}/`);

  const content = (
    <Link
      href={disabled ? '#' : path}
      aria-current={isActive ? 'page' : undefined}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      onClick={onClick}
      className={cn(
        'group relative flex min-h-10 items-center gap-3 overflow-hidden rounded-xl px-3 text-[13px] font-medium motion-safe:transition-colors min-[1600px]:min-h-11 min-[1600px]:text-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        isActive
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        disabled && 'pointer-events-none opacity-50',
        collapsed && 'size-10 min-h-0 justify-center p-0 min-[1600px]:size-11',
        nested && 'min-h-8 rounded-lg py-0 shadow-none min-[1600px]:min-h-9',
        nested && isActive && 'bg-transparent text-primary shadow-none',
      )}
    >
      {isActive && !nested && <SidebarActiveBackdrop />}
      {!nested && <Icon className="relative z-10 h-5 w-5 shrink-0" aria-hidden="true" />}
      {!collapsed && <span className="relative z-10 truncate">{label}</span>}
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
            'opacity-0 motion-safe:transition-opacity group-hover:opacity-100',
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

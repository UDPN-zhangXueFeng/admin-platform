'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from '@myorg/shared/util-i18n';
import { cn } from '@myorg/shared/util-classnames';
import { SidebarGroup } from './sidebar-group';
import { SidebarItem } from './sidebar-item';
import { SidebarActiveBackdrop } from './sidebar-active-backdrop';

export interface SidebarItemConfig {
  id: string;
  icon: LucideIcon;
  label: string;
  path?: string;
  group?: string;
  disabled?: boolean;
  children?: SidebarItemConfig[];
}

export interface SidebarProps {
  items: SidebarItemConfig[];
  collapsed: boolean;
  onToggle: () => void;
  className?: string;
}

/**
 * Application sidebar navigation.
 *
 * Features:
 * - Groups items by the optional `group` field.
 * - Recursive sub-menus: parent items with `children` render as collapsible
 *   expanders; child items are indented and animated in/out.
 * - Collapsible: shows icon-only items with CSS tooltips. Parents with
 *   children open their routes in a fixed flyout panel.
 * - Active state driven by `usePathname()` and propagated to parent items.
 * - Keyboard accessible: toggle button and all links are focusable.
 *
 * Why not Radix Tooltip? To avoid extra portal/overlay overhead for a
 * purely decorative label on hover. The CSS tooltip is sufficient here
 * and keeps the component lightweight.
 */
export function Sidebar({ items, collapsed, onToggle, className }: SidebarProps) {
  const grouped = React.useMemo(() => {
    const map = new Map<string, SidebarItemConfig[]>();
    for (const item of items) {
      const group = item.group ?? '';
      const list = map.get(group) ?? [];
      list.push(item);
      map.set(group, list);
    }
    return map;
  }, [items]);

  const groups = Array.from(grouped.entries());
  const pathname = usePathname();
  const [flyout, setFlyout] = React.useState<{
    item: SidebarItemConfig;
    top: number;
  } | null>(null);

  React.useEffect(() => {
    if (!collapsed) setFlyout(null);
  }, [collapsed]);

  const openFlyout = React.useCallback(
    (item: SidebarItemConfig, target: HTMLButtonElement) => {
      const childrenCount = item.children?.length ?? 0;
      const top = Math.min(
        target.getBoundingClientRect().top,
        window.innerHeight - childrenCount * 40 - 76,
      );

      setFlyout((current) =>
        current?.item.id === item.id ? null : { item, top },
      );
    },
    [],
  );

  /**
   * Parents whose children include the active route (used to auto-expand).
   * Iterates `items` (stable prop), NOT `groups` — `groups` is rebuilt every
   * render, so depending on it would change this callback's identity each
   * render and loop the effect below (setState → rerender → setState …).
   */
  const getActiveParentIds = React.useCallback(() => {
    const ids = new Set<string>();
    for (const item of items) {
      if (
        item.children?.some(
          (c) =>
            c.path &&
            (pathname === c.path || pathname?.startsWith(`${c.path}/`))
        )
      ) {
        ids.add(item.id);
      }
    }
    return ids;
  }, [items, pathname]);

  /** Track which parent menu ids are expanded */
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(() =>
    getActiveParentIds()
  );

  /** Auto-expand when route changes to a child of a collapsed parent */
  React.useEffect(() => {
    setExpandedIds((prev) => {
      const activeParents = getActiveParentIds();
      if (activeParents.size === 0) return prev;
      // Only add newly-active parents; never auto-collapse.
      // Return prev (same ref) when nothing actually changed, otherwise
      // `new Set(prev)` is a fresh reference and would trigger an extra render.
      const next = new Set(prev);
      for (const id of activeParents) {
        next.add(id);
      }
      if (next.size === prev.size) return prev;
      return next;
    });
  }, [getActiveParentIds]);

  const toggleExpanded = React.useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-border bg-card text-card-foreground shadow-xl shadow-foreground/5 transition-[width] duration-300 ease-in-out',
        collapsed ? 'w-20' : 'w-72',
        className
      )}
      aria-label="Main navigation"
    >
      {/* Navigation */}
      <nav className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-3 py-5">
        {groups.map(([groupName, groupItems]) => (
          <SidebarGroup
            key={groupName || 'ungrouped'}
            title={collapsed ? undefined : groupName || undefined}
          >
            {groupItems.map((item) => (
              <CollapsibleNavItem
                key={item.id}
                item={item}
                collapsed={collapsed}
                expandedIds={expandedIds}
                onToggle={toggleExpanded}
                onFlyoutOpen={openFlyout}
                onFlyoutClose={() => setFlyout(null)}
              />
            ))}
          </SidebarGroup>
        ))}
      </nav>
      {flyout && typeof document !== 'undefined' &&
        createPortal(
          <SidebarFlyout
            item={flyout.item}
            pathname={pathname}
            top={flyout.top}
            onClose={() => setFlyout(null)}
          />,
          document.body,
        )}
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Recursive sub-menu item
// ---------------------------------------------------------------------------

interface CollapsibleNavItemProps {
  item: SidebarItemConfig;
  collapsed: boolean;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onFlyoutOpen: (item: SidebarItemConfig, target: HTMLButtonElement) => void;
  onFlyoutClose: () => void;
}

/** Renders a leaf link or a collapsible parent with indented children. */
function CollapsibleNavItem({
  item,
  collapsed,
  expandedIds,
  onToggle,
  onFlyoutOpen,
  onFlyoutClose,
}: CollapsibleNavItemProps) {
  const pathname = usePathname();
  const hasChildren = item.children && item.children.length > 0;
  const isExpanded = expandedIds.has(item.id);

  /** True if any descendant (including self) is active */
  const isActive = React.useMemo(() => {
    if (!pathname) return false;
    if (item.path && (pathname === item.path || pathname.startsWith(`${item.path}/`))) {
      return true;
    }
    return item.children?.some(
      (c) => c.path && (pathname === c.path || pathname.startsWith(`${c.path}/`))
    ) ?? false;
  }, [pathname, item.path, item.children]);

  if (!hasChildren) {
    return (
      <SidebarItem
        id={item.id}
        icon={item.icon}
        label={item.label}
        path={item.path ?? '#'}
        collapsed={collapsed}
        disabled={item.disabled}
        onClick={collapsed ? onFlyoutClose : undefined}
      />
    );
  }

  if (collapsed) {
    return (
      <CollapsedParentItem
        item={item}
        isActive={isActive}
        onOpen={(target) => onFlyoutOpen(item, target)}
      />
    );
  }

  return (
    <div>
      {/* Parent toggle button */}
      <button
        type="button"
        onClick={() => onToggle(item.id)}
        aria-expanded={isExpanded}
        className={cn(
          'group relative flex h-11 w-full items-center gap-3 overflow-hidden rounded-xl px-3 text-sm font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          isActive
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        )}
      >
        {isActive && <SidebarActiveBackdrop />}
        <item.icon className="relative z-10 h-5 w-5 shrink-0" aria-hidden="true" />
        <span className="relative z-10 flex-1 truncate text-left">{item.label}</span>
        <ChevronRight
          className={cn(
            'relative z-10 h-4 w-4 shrink-0 transition-transform duration-200',
            isActive ? 'text-primary-foreground' : 'text-muted-foreground',
            isExpanded && 'rotate-90'
          )}
          aria-hidden="true"
        />
      </button>

      {/* Child items */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-200 ease-in-out',
          isExpanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className="ml-5 mt-1 space-y-1 border-l border-border pl-5">
          {item.children?.map((child) => (
            <SidebarItem
              key={child.id}
              id={child.id}
              icon={child.icon}
              label={child.label}
              path={child.path ?? '#'}
              collapsed={collapsed}
              disabled={child.disabled}
              nested
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface CollapsedParentItemProps {
  item: SidebarItemConfig;
  isActive: boolean;
  onOpen: (target: HTMLButtonElement) => void;
}

/** Icon-only parent entry that opens its secondary navigation in a flyout. */
function CollapsedParentItem({ item, isActive, onOpen }: CollapsedParentItemProps) {
  return (
    <div className="group relative flex justify-center">
      <button
        type="button"
        title={item.label}
        aria-label={item.label}
        onClick={(event) => onOpen(event.currentTarget)}
        className={cn(
          'group relative flex size-11 items-center justify-center overflow-hidden rounded-xl text-sm font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          isActive
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        )}
      >
        {isActive && <SidebarActiveBackdrop />}
        <item.icon className="relative z-10 h-5 w-5 shrink-0" aria-hidden="true" />
      </button>
      <span
        className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100"
        role="tooltip"
      >
        {item.label}
      </span>
    </div>
  );
}

interface SidebarFlyoutProps {
  item: SidebarItemConfig;
  pathname: string | null;
  top: number;
  onClose: () => void;
}

/** Fixed overlay used by collapsed parent items to expose their child routes. */
function SidebarFlyout({ item, pathname, top, onClose }: SidebarFlyoutProps) {
  const Icon = item.icon;

  return (
    <div
      className="fixed left-24 z-[60] w-64 rounded-2xl border border-border bg-popover p-2 text-popover-foreground shadow-xl shadow-foreground/10"
      style={{ top }}
      role="menu"
      aria-label={`${item.label} submenu`}
    >
      <div className="flex items-center gap-3 border-b border-border px-3 py-2.5">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{item.label}</p>
          <p className="text-xs text-muted-foreground">Select a feature</p>
        </div>
      </div>
      <ul className="mt-1 flex flex-col gap-1">
        {item.children?.map((child) => {
          const isActive = child.path ? isPathActive(pathname, child.path) : false;
          const content = (
            <>
              <span
                className={cn(
                  'mr-3 size-1.5 rounded-full bg-muted-foreground/40',
                  isActive && 'bg-primary',
                )}
              />
              {child.label}
            </>
          );

          return (
            <li key={child.id}>
              {child.disabled ? (
                <span className="flex min-h-9 w-full cursor-not-allowed items-center rounded-lg px-3 text-sm opacity-50">
                  {content}
                </span>
              ) : (
                <Link
                  href={child.path ?? '#'}
                  role="menuitem"
                  onClick={onClose}
                  className={cn(
                    'flex min-h-9 w-full items-center rounded-lg px-3 text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isActive && 'bg-primary/10 font-medium text-primary',
                  )}
                >
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function isPathActive(pathname: string | null, path: string): boolean {
  return pathname === path || pathname?.startsWith(`${path}/`) === true;
}

'use client';

import * as React from 'react';
import { ChevronRight, LucideIcon } from 'lucide-react';
import { usePathname } from '@myorg/shared/util-i18n';
import { cn } from '@myorg/shared/util-classnames';
import { SidebarGroup } from './sidebar-group';
import { SidebarItem } from './sidebar-item';

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
 * - Collapsible: shows icon-only in collapsed mode with CSS tooltips.
 *   When collapsed, parent items degrade to plain links (no room for children).
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
        'flex h-full flex-col border-r bg-card text-card-foreground transition-[width] duration-300 ease-in-out',
        collapsed ? 'w-16' : 'w-64',
        className
      )}
      aria-label="Main navigation"
    >
      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-2">
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
              />
            ))}
          </SidebarGroup>
        ))}
      </nav>
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
  depth?: number;
}

/** Renders a leaf link or a collapsible parent with indented children. */
function CollapsibleNavItem({
  item,
  collapsed,
  expandedIds,
  onToggle,
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

  // When sidebar is collapsed, always render as a plain link (no room for children)
  if (!hasChildren || collapsed) {
    return (
      <SidebarItem
        id={item.id}
        icon={item.icon}
        label={item.label}
        path={item.path ?? '#'}
        collapsed={collapsed}
        disabled={item.disabled}
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
          'group flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          isActive
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        )}
      >
        <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span className="flex-1 truncate text-left">{item.label}</span>
        <ChevronRight
          className={cn(
            'h-4 w-4 shrink-0 transition-transform duration-200',
            isActive ? 'text-primary' : 'text-muted-foreground',
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
        <div className="border-l border-border/60 ml-5 mt-1 space-y-0.5 pl-3">
          {item.children?.map((child) => (
            <SidebarItem
              key={child.id}
              id={child.id}
              icon={child.icon}
              label={child.label}
              path={child.path ?? '#'}
              collapsed={collapsed}
              disabled={child.disabled}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

'use client';

import * as React from 'react';
import { useState } from 'react';
import * as LucideIcons from 'lucide-react';
import {
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from 'lucide-react';
import type { ProjectConfig } from '@myorg/shared/util-config';
import { cn } from '@myorg/shared/util-classnames';
import { Button, Sidebar } from '@myorg/shared/ui';
import type { SidebarItemConfig } from '@myorg/shared/ui';
import { Header } from '../header/header';
import { Breadcrumb } from '../breadcrumb/breadcrumb';

export interface SidebarLayoutProps {
  config: ProjectConfig;
  children: React.ReactNode;
}

/**
 * SidebarLayout — left sidebar + top header + content.
 *
 * Features:
 * - Sidebar items are derived from `config.modules.order`.
 * - Collapsible sidebar with responsive mobile overlay.
 * - Header contains project switcher, search, notifications, and user menu.
 * - Keyboard accessible: sidebar toggle, mobile close, focus traps.
 */
export function SidebarLayout({ config, children }: SidebarLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarItems: SidebarItemConfig[] = React.useMemo(() => {
    function mapModule(mod: ProjectConfig['modules']['order'][number]): SidebarItemConfig {
      const Icon = resolveIcon(mod.icon);
      const hasChildren = mod.children && mod.children.length > 0;
      return {
        id: mod.id,
        icon: Icon,
        label: mod.label,
        // Parent items with children act as toggles — no path.
        // Leaf items use the configured path, or fall back to /{id}.
        path: hasChildren ? undefined : (mod.path ?? `/${mod.id}`),
        group: mod.group,
        disabled: mod.disabled,
        children: mod.children?.map(mapModule),
      };
    }
    return config.modules.order.map(mapModule);
  }, [config.modules.order]);

  const sidebarPosition = config.layout.sidebar.position;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Full-width top banner */}
      <Header
        config={config}
        onMenuToggle={() => setMobileOpen((v) => !v)}
      />

      {/* Body: Sidebar + Content */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {/* Mobile overlay backdrop */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Sidebar */}
        <div
          className={cn(
            'fixed inset-y-0 z-50 lg:static lg:z-auto lg:h-full lg:shrink-0',
            sidebarPosition === 'right' ? 'right-0' : 'left-0',
            mobileOpen ? 'translate-x-0' : sidebarPosition === 'right' ? 'translate-x-full' : '-translate-x-full',
            'transition-transform duration-300 ease-in-out lg:translate-x-0'
          )}
        >
          <Sidebar
            items={sidebarItems}
            collapsed={collapsed}
            onToggle={() => setCollapsed((v) => !v)}
          />
        </div>

        {/* Main content */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="z-10 flex h-10 shrink-0 items-center gap-2 px-4 shadow-[0_4px_10px_-8px_rgba(15,23,42,0.35)] lg:px-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed((value) => !value)}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-pressed={collapsed}
              className="hidden h-8 w-8 lg:inline-flex"
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
              ) : (
                <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
              )}
            </Button>
            {config.layout.breadcrumb.enabled && <Breadcrumb />}
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-4 lg:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve a Lucide icon name (e.g. "Users") to the actual component. */
function resolveIcon(name: string): LucideIcon {
  const icons = LucideIcons as unknown as Record<string, LucideIcon>;
  return icons[name] ?? icons['Box'];
}

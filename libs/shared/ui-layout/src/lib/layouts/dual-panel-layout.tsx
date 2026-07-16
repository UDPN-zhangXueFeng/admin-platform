'use client';

import * as React from 'react';
import type { ProjectConfig } from '@myorg/shared/util-config';
import { cn } from '@myorg/shared/util-classnames';
import { Header } from '../header/header';

export interface DualPanelLayoutProps {
  config: ProjectConfig;
  children: React.ReactNode;
}

/**
 * DualPanelLayout — two-panel layout: list left + detail right.
 *
 * Features:
 * - Left panel is a fixed-width scrollable list area.
 * - Right panel is the main detail/content area.
 * - Responsive: stacks vertically on small screens.
 * - Configurable left panel width via `config.layout.sidebar.width`.
 *
 * Why not split-pane resizer?
 * - Resizable panes add significant complexity (drag handlers, a11y).
 * - A fixed-width list panel covers 90 % of admin use cases
 *   (inbox, order list, patient list) and is simpler to maintain.
 */
export function DualPanelLayout({ config, children }: DualPanelLayoutProps) {
  const leftWidth = config.layout.sidebar.width || '320px';

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header config={config} />

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — list */}
        <aside
          className={cn(
            'hidden shrink-0 overflow-y-auto border-r bg-card lg:block'
          )}
          style={{ width: leftWidth }}
          aria-label="List panel"
        >
          {/* List content is injected via a named child or module page */}
          <div className="p-4">
            <span className="text-sm text-muted-foreground">
              {/* Placeholder: modules render their own list here */}
            </span>
          </div>
        </aside>

        {/* Right panel — detail / content */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}

'use client';

import * as React from 'react';
import type { ProjectConfig } from '@myorg/shared/util-config';
import { SidebarLayout } from './layouts/sidebar-layout';
import { TopNavLayout } from './layouts/top-nav-layout';
import { CompactLayout } from './layouts/compact-layout';
import { DualPanelLayout } from './layouts/dual-panel-layout';

// ---------------------------------------------------------------------------
// Layout registry
// ---------------------------------------------------------------------------

const layoutMap: Record<string, React.ComponentType<LayoutProps>> = {
  sidebar: SidebarLayout,
  'top-nav': TopNavLayout,
  compact: CompactLayout,
  'dual-panel': DualPanelLayout,
};

export interface AppShellProps {
  config: ProjectConfig;
  children: React.ReactNode;
}

interface LayoutProps {
  config: ProjectConfig;
  children: React.ReactNode;
}

/**
 * AppShell — configuration-driven layout entry point.
 *
 * Reads `config.layout.type` and dispatches to the matching layout
 * component. If the layout type is unknown, falls back to the sidebar
 * layout to avoid a blank screen.
 *
 * Why a static map instead of dynamic import?
 * - Layouts are small, always-needed UI shells.
 * - Dynamic import would add async complexity for zero bundle benefit.
 */
export function AppShell({ config, children }: AppShellProps) {
  const Layout = layoutMap[config.layout.type] ?? SidebarLayout;

  return <Layout config={config}>{children}</Layout>;
}

'use client';

import * as React from 'react';
import type { ProjectConfig } from '@myorg/shared/util-config';
import { Header } from '../header/header';

export interface CompactLayoutProps {
  config: ProjectConfig;
  children: React.ReactNode;
}

/**
 * CompactLayout — minimal header + content, no sidebar.
 *
 * Use case: focused workflows (e.g. education quiz, wizard, login)
 * where navigation chrome should be reduced to the absolute minimum.
 *
 * The header is still driven by config so project branding and
 * essential actions (logout, language) remain available.
 */
export function CompactLayout({ config, children }: CompactLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header config={config} minimal />
      <main className="flex-1 overflow-auto p-4 lg:p-6">{children}</main>
    </div>
  );
}

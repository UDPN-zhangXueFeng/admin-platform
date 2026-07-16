'use client';

import * as React from 'react';
import * as LucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from '@myorg/shared/util-i18n';
import type { ProjectConfig } from '@myorg/shared/util-config';
import { cn } from '@myorg/shared/util-classnames';
import { Header } from '../header/header';

export interface TopNavLayoutProps {
  config: ProjectConfig;
  children: React.ReactNode;
}

/**
 * TopNavLayout — horizontal top navigation + content.
 *
 * Features:
 * - Nav links rendered from `config.modules.order`.
 * - Active state via `usePathname()`.
 * - Responsive: horizontal scroll on small screens.
 */
export function TopNavLayout({ config, children }: TopNavLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header config={config} />

      {/* Horizontal nav */}
      <nav
        className="flex items-center gap-1 overflow-x-auto border-b bg-card px-4 py-2"
        aria-label="Main navigation"
      >
        {config.modules.order.map((mod) => {
          const Icon = resolveIcon(mod.icon);
          const path = `/${mod.id}`;
          const isActive =
            pathname === path || pathname?.startsWith(`${path}/`);

          return (
            <Link
              key={mod.id}
              href={path}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span>{mod.label}</span>
            </Link>
          );
        })}
      </nav>

      <main className="flex-1 overflow-auto p-4 lg:p-6">{children}</main>
    </div>
  );
}

/** Resolve a Lucide icon name to the actual component. */
function resolveIcon(name: string): LucideIcon {
  const icons = LucideIcons as unknown as Record<string, LucideIcon>;
  return icons[name] ?? icons['Box'];
}

'use client';

import * as React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { usePathname } from '@myorg/shared/util-i18n';
import Link from 'next/link';
import { cn } from '@myorg/shared/util-classnames';
import { useModules } from '@myorg/shared/util-config';

export interface BreadcrumbProps {
  className?: string;
}

/**
 * Dynamic breadcrumb derived from the current URL pathname.
 *
 * Features:
 * - Splits pathname into segments and renders each as a link.
 * - Skips locale segments (e.g. /en, /zh-CN) automatically.
 * - Home link is always present.
 * - Last segment is non-interactive (current page).
 *
 * Module labels:
 * - The first segment resolves its label from `config.modules.order` so the
 *   breadcrumb stays in sync with the sidebar menu. Remaining segments are
 *   humanized from the URL slug (e.g. "user-list" → "User List").
 */
export function Breadcrumb({ className }: BreadcrumbProps) {
  const pathname = usePathname();
  const { order } = useModules();
  const segments = React.useMemo(() => {
    if (!pathname) return [];
    return pathname
      .split('/')
      .filter((s) => s.length > 0 && !isLocaleSegment(s));
  }, [pathname]);

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex items-center gap-1 text-sm text-muted-foreground">
        {/* Home */}
        <li>
          <Link
            href="/"
            className={cn(
              'flex items-center gap-1 transition-colors hover:text-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
            )}
          >
            <Home className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only">Home</span>
          </Link>
        </li>

        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1;
          const href = '/' + segments.slice(0, index + 1).join('/');
          const label =
            index === 0
              ? (order?.find((m) => m.id === segment)?.label ??
                humanize(segment))
              : humanize(segment);

          return (
            <React.Fragment key={href}>
              <li aria-hidden="true">
                <ChevronRight className="h-3.5 w-3.5" />
              </li>
              <li>
                {isLast ? (
                  <span
                    className="font-medium text-foreground"
                    aria-current="page"
                  >
                    {label}
                  </span>
                ) : (
                  <Link
                    href={href}
                    className={cn(
                      'transition-colors hover:text-foreground',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
                    )}
                  >
                    {label}
                  </Link>
                )}
              </li>
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const localePattern = /^(zh-CN|zh-TW|en|ja|ko|de|fr|es|it|pt|ru)$/;

function isLocaleSegment(segment: string): boolean {
  return localePattern.test(segment);
}

/** Convert a URL slug into a human-readable label. */
function humanize(slug: string): string {
  return slug
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

'use client';

import * as React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { Link, usePathname } from '@myorg/shared/util-i18n';
import { cn } from '@myorg/shared/util-classnames';
import { useModules } from '@myorg/shared/util-config';

export interface BreadcrumbProps {
  className?: string;
}

/**
 * Dynamic breadcrumb derived from the current URL pathname.
 *
 * Features:
 * - Resolves crumbs from the configured menu hierarchy matched against the
 *   pathname, falling back to URL segments when no menu path matches.
 * - Skips locale segments (e.g. /en, /zh-CN) automatically.
 * - Home link is always present.
 * - Last entry is non-interactive (current page).
 *
 * Module labels:
 * - The configured menu path that matches the longest URL prefix wins, and
 *   the whole matched menu chain renders as one crumb per menu entry
 *   (ancestors first), so grouped menus with flat child routes keep their
 *   hierarchy (e.g. /chart-of-accounts →
 *   "Accounting Management" > "Chart of Accounts").
 * - Route segments after the matched path (detail views) and path segments
 *   beyond the matched menu depth (e.g. /transaction-flow/stablecoin) render
 *   after the chain.
 * - URLs matching no configured path fall back to per-segment labels resolved
 *   from `config.modules.order` ids, then to the humanized URL slug
 *   (e.g. "user-list" → "User List"; detail ids show the id itself).
 */

type OrderItem = {
  id: string;
  label?: string;
  path?: string;
  disabled?: boolean;
  children?: OrderItem[];
};

/** 深度查找模块标签：先在 order 顶层找，再递归各组 children。 */
function findModuleLabel(
  items: OrderItem[] | undefined,
  segment: string,
): string | undefined {
  if (!items) return undefined;
  for (const item of items) {
    if (item.id === segment) return item.label;
    if (item.children?.length) {
      const nested = findModuleLabel(item.children, segment);
      if (nested) return nested;
    }
  }
  return undefined;
}

type BreadcrumbEntry = {
  key: string;
  label: string;
  href?: string;
};

type RouteMatch = {
  chain: OrderItem[];
  pathSegments: string[];
};

/** Split a configured path into locale-free, non-empty segments. */
function toPathSegments(path: string | undefined): string[] {
  if (!path) return [];
  return path
    .split('/')
    .filter((segment) => segment.length > 0 && !isLocaleSegment(segment));
}

/**
 * Find the configured menu entry whose path is the longest prefix of the URL.
 *
 * Ties go to the deeper menu chain, so a child route wins over its parent when
 * both declare the same path (e.g. System Management > User Management both at
 * `/system/user`).
 */
function findRouteMatch(
  items: OrderItem[] | undefined,
  segments: string[],
): RouteMatch | undefined {
  let best: RouteMatch | undefined;

  const visit = (item: OrderItem, ancestors: OrderItem[]) => {
    const chain = [...ancestors, item];
    const pathSegments = toPathSegments(item.path);
    const isPrefix =
      pathSegments.length > 0 &&
      pathSegments.length <= segments.length &&
      pathSegments.every((segment, index) => segments[index] === segment);

    if (
      isPrefix &&
      (!best ||
        pathSegments.length > best.pathSegments.length ||
        (pathSegments.length === best.pathSegments.length &&
          chain.length > best.chain.length))
    ) {
      best = { chain, pathSegments };
    }

    item.children?.forEach((child) => visit(child, chain));
  };

  items?.forEach((item) => visit(item, []));
  return best;
}

/**
 * Menu target for a breadcrumb segment:
 * - group with children → first navigable child path (depth-first)
 * - leaf with path → itself
 * - no path → undefined (caller falls back to the URL-derived href)
 */
function firstNavigablePath(item: OrderItem): string | undefined {
  if (item.path) return item.path;
  for (const child of item.children ?? []) {
    if (child.disabled) continue;
    const path = firstNavigablePath(child);
    if (path) return path;
  }
  return undefined;
}

/**
 * Map every configured route prefix to the breadcrumb target.
 *
 * For a group such as `key-management` the prefix `/key-management` maps to the
 * first navigable child (`/key-management/key-service-configuration`); for a
 * leaf the exact path maps to itself. The first configured item for a prefix
 * wins, so a group's first-child prefix stays that child's path.
 */
function buildBreadcrumbTargets(
  items: OrderItem[] | undefined,
): Map<string, string> {
  const targets = new Map<string, string>();

  const visit = (item: OrderItem) => {
    if (!item.disabled) {
      const target = firstNavigablePath(item);
      if (target) {
        const targetSegments = target
          .split('/')
          .filter((segment) => segment.length > 0 && !isLocaleSegment(segment));
        for (let index = 1; index <= targetSegments.length; index += 1) {
          const prefix = `/${targetSegments.slice(0, index).join('/')}`;
          if (!targets.has(prefix)) targets.set(prefix, target);
        }
      }
    }
    for (const child of item.children ?? []) visit(child);
  };

  items?.forEach(visit);
  return targets;
}

/**
 * Build breadcrumb entries for the current URL.
 *
 * A matched menu chain renders one entry per menu item even when the URL has
 * fewer segments (flat child routes under a group). Ancestors keep the sidebar
 * group-link semantics; trailing route segments render as path/detail crumbs.
 * Without a configured match the URL segments remain the source of truth.
 */
function buildBreadcrumbEntries(
  items: OrderItem[] | undefined,
  segments: string[],
  targets: Map<string, string>,
): BreadcrumbEntry[] {
  const match = findRouteMatch(items, segments);

  if (!match) {
    return segments.map((segment, index) => {
      const pathHref = `/${segments.slice(0, index + 1).join('/')}`;
      return {
        key: `url:${index}:${segment}`,
        label: findModuleLabel(items, segment) ?? humanize(segment),
        href:
          index === segments.length - 1
            ? undefined
            : targets.get(pathHref) ?? pathHref,
      };
    });
  }

  const entries: BreadcrumbEntry[] = match.chain.map((item, index) => ({
    key: `menu:${index}:${item.id}`,
    label: item.label ?? humanize(item.id),
    href: item.path ?? firstNavigablePath(item),
  }));

  const matchedPathLength = match.pathSegments.length;

  const appendRouteSegment = (index: number, keyPrefix: string) => {
    const segment = segments[index];
    const pathHref = `/${segments.slice(0, index + 1).join('/')}`;
    entries.push({
      key: `${keyPrefix}:${index}:${segment}`,
      label: findModuleLabel(items, segment) ?? humanize(segment),
      href: targets.get(pathHref) ?? pathHref,
    });
  };

  // Path segments beyond the matched menu depth belong to the selected menu
  // item's own path (e.g. `/transaction-flow/stablecoin`).
  for (let index = match.chain.length; index < matchedPathLength; index += 1) {
    appendRouteSegment(index, 'path');
  }

  // Segments after the matched path are detail views (`.../view`, ids, ...).
  for (let index = matchedPathLength; index < segments.length; index += 1) {
    appendRouteSegment(index, 'detail');
  }

  if (entries.length > 0) {
    entries[entries.length - 1] = {
      ...entries[entries.length - 1],
      href: undefined,
    };
  }

  return entries;
}

export function Breadcrumb({ className }: BreadcrumbProps) {
  const pathname = usePathname();
  const { order } = useModules();
  const segments = React.useMemo(() => {
    if (!pathname) return [];
    return pathname
      .split('/')
      .filter((s) => s.length > 0 && !isLocaleSegment(s));
  }, [pathname]);
  const breadcrumbTargets = React.useMemo(
    () => buildBreadcrumbTargets(order),
    [order],
  );
  const entries = React.useMemo(
    () => buildBreadcrumbEntries(order, segments, breadcrumbTargets),
    [order, segments, breadcrumbTargets],
  );

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex items-center gap-1 text-sm text-muted-foreground">
        {/* Home */}
        <li>
          <Link
            href="/"
            className={cn(
              'flex items-center gap-1 transition-colors hover:text-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            )}
          >
            <Home className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only">Home</span>
          </Link>
        </li>

        {entries.map((entry, index) => {
          const isLast = index === entries.length - 1;
          return (
            <React.Fragment key={entry.key}>
              <li aria-hidden="true">
                <ChevronRight className="h-3.5 w-3.5" />
              </li>
              <li>
                {isLast ? (
                  <span
                    className="font-medium text-foreground"
                    aria-current="page"
                  >
                    {entry.label}
                  </span>
                ) : entry.href ? (
                  <Link
                    href={entry.href}
                    className={cn(
                      'transition-colors hover:text-foreground',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    )}
                  >
                    {entry.label}
                  </Link>
                ) : (
                  <span>{entry.label}</span>
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
  return slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

'use client';

import { use, useMemo } from 'react';
import { useConfig } from '@myorg/shared/util-config';
import type { ComponentType } from 'react';
import { loadLpPortalModulePage } from './module-page-registry';

/**
 * Maps a route `module` segment that is actually a menu GROUP to the
 * config.modules.enabled key that gates it. Per the lp-portal routing
 * contract (§5.3) only `sys` is a group prefix: `/sys/user`, `/sys/role`,
 * `/sys/menu` resolve to the user / role / menu modules respectively, gated
 * by the `sys` enabled flag. All other modules are top-level.
 */
const GROUP_ENABLED_KEY: Record<string, string> = {
  sys: 'sys',
};

/**
 * Dynamic module route — every lp-portal module page is served from this
 * single catch-all entry.
 *
 * Route examples:
 *   /en-US/dashboard            → module=dashboard, slug=[]        → list
 *   /en-US/pool                 → module=pool,     slug=[]         → list
 *   /en-US/pool/create          → module=pool,     slug=[create]   → create
 *   /en-US/pool/p-1024          → module=pool,     slug=[p-1024]   → detail
 *   /en-US/sys/user             → module=sys,      slug=[user]     → user/list
 *   /en-US/sys/role/u-7/edit    → module=sys,      slug=[role,u-7,edit] → role/edit
 *
 * The (real) module must be listed in config.modules.enabled (or, for group
 * routes, the group key must be enabled), otherwise a "module not found"
 * placeholder is shown. The actual page component is loaded via
 * loadLpPortalModulePage, which uses next/dynamic with ssr:false.
 */
export default function ModulePage({
  params,
}: {
  params: Promise<{ locale: string; module: string; slug?: string[] }>;
}) {
  const { module, slug } = use(params);
  const { config } = useConfig();

  const groupKey = GROUP_ENABLED_KEY[module];
  const isGroup = Boolean(groupKey);
  const realModule = isGroup && slug && slug.length > 0 ? slug[0] : module;
  const realSlug = isGroup ? (slug ? slug.slice(1) : []) : slug;

  const isEnabled = isGroup
    ? config.modules.enabled.includes(groupKey as string)
    : config.modules.enabled.includes(module);

  const pageKey = useMemo(() => {
    if (!realSlug || realSlug.length === 0) return 'list';
    if (realSlug[0] === 'create') return 'create';
    if (realSlug[0] === 'edit') return 'edit';
    return 'detail';
  }, [realSlug]);

  const PageComponent = useMemo(() => {
    if (!isEnabled) return null;
    return loadLpPortalModulePage(realModule, pageKey) as ComponentType<unknown> | null;
  }, [realModule, pageKey, isEnabled]);

  if (!isEnabled) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
        Module &quot;{module}&quot; is not enabled.
      </div>
    );
  }
  if (!PageComponent) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
        Page not found for module &quot;{realModule}&quot; ({pageKey}).
      </div>
    );
  }
  return <PageComponent />;
}

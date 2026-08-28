'use client';

import { use, useMemo } from 'react';
import type { ComponentType } from 'react';
import { useConfig } from '@myorg/shared/util-config';
import { loadKissenGatewayModulePage } from './module-page-registry';

/**
 * Group routing: `/system/<sub-module>/...` treats the first slug segment
 * as the sub-module name, the rest as that sub-module's slug. The group's
 * enabled state maps to the matching key in `config.modules.enabled`.
 *
 * e.g. /system/user/create  → user create
 */
const GROUP_ENABLED_KEY: Record<string, string> = {
  system: 'system',
};

/**
 * Flat-module page segments（GW-14 两段顶层路径）: the first slug segment is
 * a fixed page name, not an entity id. Upstream `router/index.ts`:
 *   /token/manage → token manage page (main list)
 *   /bank/query   → bank query page (main list)
 * Such segments map to the module's 'list' page key in the registry.
 */
const FLAT_PAGE_SEGMENTS: ReadonlySet<string> = new Set(['manage', 'query']);

/**
 * Dynamic module route — all module pages are served from this single entry.
 *
 * Route examples:
 *   /en/onboard           → module=onboard, slug=[]      → pageKey="list"
 *   /en/onboard/create    → module=onboard, slug=["create"] → pageKey="create"
 *   /en/onboard/123       → module=onboard, slug=["123"]   → pageKey="detail"
 *
 * Two-segment flat routes (GW-14):
 *   /en/token/manage      → module=token, slug=["manage"] → pageKey="list"
 *   /en/bank/query        → module=bank,   slug=["query"] → pageKey="list"
 *
 * Group routes:
 *   /en/system/user/456   → module=system, slug=["user","456"] → realModule="user", pageKey="detail"
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
    // GW-14: /token/manage、/bank/query 的首段是固定页名而非实体 id，
    // 映射到 registry 的 'list' 主页键。
    if (!isGroup && FLAT_PAGE_SEGMENTS.has(realSlug[0])) return 'list';
    if (realSlug[0] === 'create') return 'create';
    if (realSlug[0] === 'edit') return 'edit';
    return 'detail';
  }, [realSlug, isGroup]);

  const PageComponent = useMemo(() => {
    if (!isEnabled) return null;
    return loadKissenGatewayModulePage(
      realModule,
      pageKey,
    ) as ComponentType<unknown> | null;
  }, [realModule, pageKey, isEnabled]);

  if (!isEnabled) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <h2 className="text-2xl font-bold">Module Not Found</h2>
        <p className="text-muted-foreground">
          The module &quot;{module}&quot; is not available in this project.
        </p>
      </div>
    );
  }

  if (!PageComponent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <h2 className="text-2xl font-bold">Page Not Found</h2>
        <p className="text-muted-foreground">
          No page found for module &quot;{module}&quot; with key &quot;{pageKey}
          &quot;.
        </p>
      </div>
    );
  }

  return <PageComponent />;
}

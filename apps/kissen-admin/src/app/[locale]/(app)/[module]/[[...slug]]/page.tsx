'use client';

import { use, useMemo } from 'react';
import { useConfig } from '@myorg/shared/util-config';
import type { ComponentType } from 'react';
import { loadKissenAdminModulePage } from './module-page-registry';

/**
 * Group routing: certain top-level route segments are menu *groups* whose
 * enabled state is keyed by the group name in config.modules.enabled, while
 * the first slug segment names the real sub-module.
 *
 *   /bank-onboard/<sub>/... → group 'bank-onboard', module = slug[0]
 *
 * See contract §5.1 for the full GROUP_ENABLED_KEY table.
 */
const GROUP_ENABLED_KEY: Record<string, string> = {
  onboard: 'onboard',
  'fx-rate': 'fx-rate',
  liquidity: 'liquidity',
  // Legacy backend menu URL: /lp-liquidity/lp-info/... maps to the current
  // LP group enabled key while keeping the old URL backward compatible.
  'lp-liquidity': 'lp',
  settle: 'settle',
  transfer: 'transfer',
  system: 'system',
};

/** Legacy LP child ids → current module registry ids. */
const MODULE_ALIAS: Record<string, string> = {
  'lp-info': 'lp',
  'lp-pool': 'pool',
  'lp-currency-pair': 'lp-pair',
};

/**
 * Dynamic module route — all module pages are served from this single entry.
 *
 * Route examples:
 *   /en/dashboard                 → module=dashboard, slug=[]        → pageKey="list"
 *   /en/bank-info                 → module=bank-info, slug=[]        → pageKey="list"
 *   /en/bank-info/create          → module=bank-info, slug=["create"] → pageKey="create"
 *   /en/bank-info/123             → module=bank-info, slug=["123"]   → pageKey="detail"
 *
 * The module (or its group) must be listed in config.modules.enabled,
 * otherwise a "Module Not Found" message is shown. The actual page component
 * is loaded via loadKissenAdminModulePage which uses next/dynamic with
 * ssr:false for code splitting.
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
  // For group segments the first slug is the sub-module id; for flat modules
  // the module param is already the module id.
  const requestedModule =
    isGroup && slug && slug.length > 0 ? slug[0] : module;
  const realModule = MODULE_ALIAS[requestedModule] ?? requestedModule;
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
    return loadKissenAdminModulePage(
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

'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

type PageLoader = () => Promise<{ default: ComponentType<unknown> }>;

/**
 * Build a lazy loader for a named export of the lp-portal feature lib.
 *
 * The import specifier is an inline string literal so webpack/Next can code-
 * split the feature lib into its own chunk. The dynamic export lookup keeps
 * the registry declarative — every page is described by its module id and a
 * feature-lib export name.
 */
function lp(moduleExport: string): PageLoader {
  return () =>
    import('@myorg/modules/lp-portal/feature').then((m) => ({
      default: (m as Record<string, ComponentType<unknown>>)[moduleExport],
    }));
}

/**
 * lp-portal module page registry (§5.3).
 *
 * Top-level key  = module id (the route segment, or the resolved sub-module
 *                  for group routes like /sys/user).
 * Inner key      = page key derived from the slug: list | create | edit | detail.
 * Value          = loader returning the feature-lib page component.
 *
 * `create` and `edit` both resolve to the module's single FormPage.
 */
const pages: Record<string, Record<string, PageLoader>> = {
  dashboard: {
    list: lp('DashboardPage'),
  },
  pool: {
    list: lp('PoolListPage'),
    create: lp('PoolFormPage'),
    edit: lp('PoolFormPage'),
    detail: lp('PoolDetailPage'),
  },
  preauth: {
    list: lp('PreauthListPage'),
    create: lp('PreauthFormPage'),
    edit: lp('PreauthFormPage'),
    detail: lp('PreauthDetailPage'),
  },
  topup: {
    list: lp('TopupListPage'),
    create: lp('TopupFormPage'),
    detail: lp('TopupDetailPage'),
  },
  pair: {
    list: lp('PairListPage'),
    detail: lp('PairDetailPage'),
  },
  rate: {
    list: lp('RateListPage'),
  },
  'tx-flow': {
    list: lp('TxFlowListPage'),
    detail: lp('TxFlowDetailPage'),
  },
  settle: {
    list: lp('SettleListPage'),
    detail: lp('SettleDetailPage'),
  },
  receipt: {
    list: lp('ReceiptListPage'),
    detail: lp('ReceiptDetailPage'),
  },
  notify: {
    list: lp('NotifyListPage'),
  },
  syslog: {
    list: lp('SyslogListPage'),
  },
  user: {
    list: lp('UserListPage'),
    create: lp('UserFormPage'),
    edit: lp('UserFormPage'),
    detail: lp('UserDetailPage'),
  },
  role: {
    list: lp('RoleListPage'),
    create: lp('RoleFormPage'),
    edit: lp('RoleFormPage'),
    detail: lp('RoleDetailPage'),
  },
  menu: {
    list: lp('MenuListPage'),
  },
};

/**
 * Resolve a (real) module id + page key to a renderable page component.
 *
 * Returns null when the module/page combination is not registered, so the
 * caller can render its "page not found" placeholder. Each call wraps the
 * loader in next/dynamic with ssr:false — page components are client-only.
 */
export function loadLpPortalModulePage(
  moduleId: string,
  pageKey: string,
): ComponentType<unknown> | null {
  const loader = pages[moduleId]?.[pageKey];
  if (!loader) return null;
  return dynamic(() => loader(), { ssr: false }) as unknown as ComponentType<unknown>;
}

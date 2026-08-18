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
  // 资金池（B1 真实页）：源为单页只读视图，无 create/edit/detail 路由。
  pool: {
    list: lp('PoolListPage'),
  },
  // 补资（B2 真实页）：源为只读分页列表，无 create/detail 路由。
  topup: {
    list: lp('TopupListPage'),
  },
  // 货币对与资金池（B4 真实页）：源为单页主表+展开行聚合，无 detail 路由。
  pair: {
    list: lp('PairListPage'),
  },
  rate: {
    list: lp('RateListPage'),
  },
  // 交易流水（B5/B6 真实页）：源为单页，链路明细即行点击开的页内抽屉，
  // 无 detail 路由。
  'tx-flow': {
    list: lp('TxFlowListPage'),
  },
  // 结算（B7 真实页）：源为单页双 tab（流水/结算单），无 detail 路由。
  settle: {
    list: lp('SettleListPage'),
  },
  // 源端收款明细（D1 占位页）：源 source-receipt 路由挂 placeholder.vue，
  // 登录后菜单可见即显示「功能建设中」占位，无 detail 路由。
  receipt: {
    list: lp('ReceiptListPage'),
  },
  syslog: {
    list: lp('SyslogListPage'),
  },
  // 用户管理（C1 真实页）：源为单页——新增/编辑/分配角色/重置密码均为
  // 页内弹窗，无 create/edit/detail 路由。
  user: {
    list: lp('UserListPage'),
  },
  // 角色管理（C2/R3 真实页）：源为单页——新增/编辑/菜单分配均为页内
  // 弹窗，无 create/edit/detail 路由。
  role: {
    list: lp('RoleListPage'),
  },
  // 菜单管理（C3 真实页）：源为左树右表单单页，无子路由。
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

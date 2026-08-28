'use client';
import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import type * as KissenFeature from '@myorg/modules/kissen-admin/feature';

/**
 * Module page registry for kissen-admin (v2.0 tokenization layout).
 *
 * Maps each module id → page key → dynamic loader that pulls the matching
 * component from @myorg/modules/kissen-admin/feature. Every loader uses an
 * inline string literal so webpack can statically resolve and code-split each
 * chunk (a bare variable would defeat static analysis).
 *
 * v2.0 module ids mirror the upstream menu tree (787ccc9):
 *   onboard/{bank,instance,token,lp,lp-pair}, fx-rate/pair,
 *   liquidity/pool, settle/{order,cycle}, transfer/tx,
 *   system/{user,role,menu,workflow,log}.
 *
 * Page-key → component convention:
 *   list   → <Pascal>ListPage
 *   detail → <Pascal>DetailPage
 *   create → <Pascal>FormPage
 *   edit   → <Pascal>FormPage
 */

type PageLoader = () => Promise<{ default: ComponentType<unknown> }>;

/**
 * 源 `views/placeholder.vue` 等价物 —— 菜单项存在但暂无对应页面（或该模块
 * 仅有前端占位语义）时渲染「功能将在后续版本开放」空态，绝不渲染伪造数据。
 */
const placeholderLoader: PageLoader = () =>
  import('@myorg/modules/kissen-admin/feature').then((m) => ({
    default: m.KissenPlaceholderPage as unknown as ComponentType<unknown>,
  }));

const featureImport = () => import('@myorg/modules/kissen-admin/feature');

const loader =
  (pick: (m: typeof KissenFeature) => unknown): PageLoader =>
  () =>
    featureImport().then((m) => ({
      default: pick(m) as unknown as ComponentType<unknown>,
    }));

const pages: Record<string, Record<string, PageLoader>> = {
  // 后端 menuTree 的 workbench 菜单项 menuUrl=/workbench（源 MENU_ROUTE_MAP
  // 'workbench': '/workbench'）；/dashboard 保留为兼容别名。
  dashboard: {
    list: loader((m) => m.DashboardPage),
  },

  workbench: {
    list: loader((m) => m.DashboardPage),
  },

  approval: {
    list: loader((m) => m.ApprovalCenterListPage),
  },

  // ---- onboard ----
  bank: {
    list: loader((m) => m.BankInfoListPage),
    create: loader((m) => m.BankInfoFormPage),
    edit: loader((m) => m.BankInfoFormPage),
    detail: loader((m) => m.BankInfoDetailPage),
  },

  instance: {
    list: loader((m) => m.GatewayInstanceListPage),
  },

  token: {
    list: loader((m) => m.TokenManageListPage),
  },

  lp: {
    list: loader((m) => m.LpInfoListPage),
    create: loader((m) => m.LpInfoFormPage),
    edit: loader((m) => m.LpInfoFormPage),
    detail: loader((m) => m.LpInfoDetailPage),
  },

  'lp-pair': {
    list: loader((m) => m.LpTokenPairListPage),
  },

  // ---- fx-rate / liquidity ----
  pair: {
    list: loader((m) => m.TokenPairListPage),
  },

  pool: {
    list: loader((m) => m.LpPoolListPage),
  },

  // ---- settle ----
  order: {
    list: loader((m) => m.SettleOrderListPage),
  },

  cycle: {
    list: loader((m) => m.SettleCycleListPage),
  },

  // ---- transfer ----
  tx: {
    list: loader((m) => m.TxListListPage),
  },

  // ---- system ----
  user: {
    list: loader((m) => m.SysUserListPage),
    create: loader((m) => m.SysUserFormPage),
    edit: loader((m) => m.SysUserFormPage),
    detail: loader((m) => m.SysUserDetailPage),
  },

  role: {
    list: loader((m) => m.SysRoleListPage),
    create: loader((m) => m.SysRoleFormPage),
    edit: loader((m) => m.SysRoleFormPage),
    detail: loader((m) => m.SysRoleDetailPage),
  },

  menu: {
    list: loader((m) => m.SysMenuListPage),
  },

  workflow: {
    list: loader((m) => m.WorkflowConfigListPage),
    create: loader((m) => m.WorkflowConfigFormPage),
    edit: loader((m) => m.WorkflowConfigFormPage),
    detail: loader((m) => m.WorkflowConfigDetailPage),
  },

  log: {
    list: loader((m) => m.OperateLogListPage),
  },

  _placeholder: {
    list: placeholderLoader,
  },
};

/**
 * Resolve a module + page key to a lazily-loaded component, or null when no
 * loader is registered. The dynamic import is ssr:false so all mock pages run
 * client-side only.
 */
export function loadKissenAdminModulePage(
  moduleId: string,
  pageKey: string,
): ComponentType<unknown> | null {
  const loaderFn = pages[moduleId]?.[pageKey] ?? placeholderLoader;
  return dynamic(() => loaderFn(), {
    ssr: false,
  }) as unknown as ComponentType<unknown>;
}

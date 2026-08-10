'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

/**
 * Module page registry for kissen-admin.
 *
 * Maps each module id (§5.1) → page key → dynamic loader that pulls the
 * matching mock component from @myorg/modules/kissen-admin/feature. Every
 * loader uses an inline string literal so webpack can statically resolve and
 * code-split each chunk (a bare variable would defeat static analysis).
 *
 * Page-key → component convention (§6.3):
 *   list   → <Pascal>ListPage      (dashboard → DashboardPage)
 *   detail → <Pascal>DetailPage
 *   create → <Pascal>FormPage
 *   edit   → <Pascal>FormPage
 */
type PageLoader = () => Promise<{ default: ComponentType<unknown> }>;

const FEATURE = '@myorg/modules/kissen-admin/feature';

const pages: Record<string, Record<string, PageLoader>> = {
  dashboard: {
    list: () =>
      import('@myorg/modules/kissen-admin/feature').then((m) => ({
        default: m.DashboardPage as unknown as ComponentType<unknown>,
      })),
  },

  'bank-info': {
    list: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.BankInfoListPage as unknown as ComponentType<unknown> })),
    create: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.BankInfoFormPage as unknown as ComponentType<unknown> })),
    edit: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.BankInfoFormPage as unknown as ComponentType<unknown> })),
    detail: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.BankInfoDetailPage as unknown as ComponentType<unknown> })),
  },

  'bank-approval': {
    list: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.BankApprovalListPage as unknown as ComponentType<unknown> })),
    detail: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.BankApprovalDetailPage as unknown as ComponentType<unknown> })),
  },

  'gateway-register': {
    list: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.GatewayRegisterListPage as unknown as ComponentType<unknown> })),
    create: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.GatewayRegisterFormPage as unknown as ComponentType<unknown> })),
    edit: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.GatewayRegisterFormPage as unknown as ComponentType<unknown> })),
    detail: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.GatewayRegisterDetailPage as unknown as ComponentType<unknown> })),
  },

  'lp-info': {
    list: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.LpInfoListPage as unknown as ComponentType<unknown> })),
    create: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.LpInfoFormPage as unknown as ComponentType<unknown> })),
    edit: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.LpInfoFormPage as unknown as ComponentType<unknown> })),
    detail: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.LpInfoDetailPage as unknown as ComponentType<unknown> })),
  },

  'lp-pool': {
    list: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.LpPoolListPage as unknown as ComponentType<unknown> })),
    create: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.LpPoolFormPage as unknown as ComponentType<unknown> })),
    edit: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.LpPoolFormPage as unknown as ComponentType<unknown> })),
    detail: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.LpPoolDetailPage as unknown as ComponentType<unknown> })),
  },

  'lp-preauth': {
    list: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.LpPreauthListPage as unknown as ComponentType<unknown> })),
    create: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.LpPreauthFormPage as unknown as ComponentType<unknown> })),
    edit: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.LpPreauthFormPage as unknown as ComponentType<unknown> })),
    detail: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.LpPreauthDetailPage as unknown as ComponentType<unknown> })),
  },

  'lp-currency-pair': {
    list: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.LpCurrencyPairListPage as unknown as ComponentType<unknown> })),
    detail: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.LpCurrencyPairDetailPage as unknown as ComponentType<unknown> })),
  },

  'lp-topup': {
    list: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.LpTopupListPage as unknown as ComponentType<unknown> })),
    detail: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.LpTopupDetailPage as unknown as ComponentType<unknown> })),
  },

  'lp-water-level': {
    list: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.LpWaterLevelListPage as unknown as ComponentType<unknown> })),
  },

  'currency-pair': {
    list: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.CurrencyPairListPage as unknown as ComponentType<unknown> })),
    create: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.CurrencyPairFormPage as unknown as ComponentType<unknown> })),
    edit: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.CurrencyPairFormPage as unknown as ComponentType<unknown> })),
    detail: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.CurrencyPairDetailPage as unknown as ComponentType<unknown> })),
  },

  'rate-config': {
    list: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.RateConfigListPage as unknown as ComponentType<unknown> })),
    create: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.RateConfigFormPage as unknown as ComponentType<unknown> })),
    edit: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.RateConfigFormPage as unknown as ComponentType<unknown> })),
    detail: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.RateConfigDetailPage as unknown as ComponentType<unknown> })),
  },

  'rate-push-log': {
    list: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.RatePushLogListPage as unknown as ComponentType<unknown> })),
  },

  'tx-list': {
    list: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.TxListListPage as unknown as ComponentType<unknown> })),
    detail: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.TxListDetailPage as unknown as ComponentType<unknown> })),
  },

  'tx-exception': {
    list: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.TxExceptionListPage as unknown as ComponentType<unknown> })),
    detail: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.TxExceptionDetailPage as unknown as ComponentType<unknown> })),
  },

  'tx-reversal': {
    list: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.TxReversalListPage as unknown as ComponentType<unknown> })),
  },

  'settle-record': {
    list: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.SettleRecordListPage as unknown as ComponentType<unknown> })),
    detail: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.SettleRecordDetailPage as unknown as ComponentType<unknown> })),
  },

  'settle-order': {
    list: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.SettleOrderListPage as unknown as ComponentType<unknown> })),
    detail: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.SettleOrderDetailPage as unknown as ComponentType<unknown> })),
  },

  'split-transfer': {
    list: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.SplitTransferListPage as unknown as ComponentType<unknown> })),
    detail: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.SplitTransferDetailPage as unknown as ComponentType<unknown> })),
  },

  reconcile: {
    list: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.ReconcileListPage as unknown as ComponentType<unknown> })),
    detail: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.ReconcileDetailPage as unknown as ComponentType<unknown> })),
  },

  freeze: {
    list: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.FreezeListPage as unknown as ComponentType<unknown> })),
    detail: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.FreezeDetailPage as unknown as ComponentType<unknown> })),
  },

  'monitor-rule': {
    list: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.MonitorRuleListPage as unknown as ComponentType<unknown> })),
    create: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.MonitorRuleFormPage as unknown as ComponentType<unknown> })),
    edit: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.MonitorRuleFormPage as unknown as ComponentType<unknown> })),
    detail: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.MonitorRuleDetailPage as unknown as ComponentType<unknown> })),
  },

  'monitor-hit': {
    list: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.MonitorHitListPage as unknown as ComponentType<unknown> })),
    detail: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.MonitorHitDetailPage as unknown as ComponentType<unknown> })),
  },

  'approval-center': {
    list: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.ApprovalCenterListPage as unknown as ComponentType<unknown> })),
    detail: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.ApprovalCenterDetailPage as unknown as ComponentType<unknown> })),
  },

  'sys-user': {
    list: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.SysUserListPage as unknown as ComponentType<unknown> })),
    create: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.SysUserFormPage as unknown as ComponentType<unknown> })),
    edit: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.SysUserFormPage as unknown as ComponentType<unknown> })),
    detail: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.SysUserDetailPage as unknown as ComponentType<unknown> })),
  },

  'sys-role': {
    list: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.SysRoleListPage as unknown as ComponentType<unknown> })),
    create: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.SysRoleFormPage as unknown as ComponentType<unknown> })),
    edit: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.SysRoleFormPage as unknown as ComponentType<unknown> })),
    detail: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.SysRoleDetailPage as unknown as ComponentType<unknown> })),
  },

  'sys-menu': {
    list: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.SysMenuListPage as unknown as ComponentType<unknown> })),
  },

  'workflow-config': {
    list: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.WorkflowConfigListPage as unknown as ComponentType<unknown> })),
    create: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.WorkflowConfigFormPage as unknown as ComponentType<unknown> })),
    edit: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.WorkflowConfigFormPage as unknown as ComponentType<unknown> })),
    detail: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.WorkflowConfigDetailPage as unknown as ComponentType<unknown> })),
  },

  'scheduled-task': {
    list: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.ScheduledTaskListPage as unknown as ComponentType<unknown> })),
    detail: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.ScheduledTaskDetailPage as unknown as ComponentType<unknown> })),
  },

  'operate-log': {
    list: () => import('@myorg/modules/kissen-admin/feature').then((m) => ({ default: m.OperateLogListPage as unknown as ComponentType<unknown> })),
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
  const loader = pages[moduleId]?.[pageKey];
  if (!loader) return null;
  return dynamic(() => loader(), {
    ssr: false,
  }) as unknown as ComponentType<unknown>;
}

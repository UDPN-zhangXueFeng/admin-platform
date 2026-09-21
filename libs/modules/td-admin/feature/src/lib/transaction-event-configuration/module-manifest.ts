import type { ModuleManifest } from '@myorg/shared/model';

/**
 * Transaction Event Configuration 模块清单。
 *
 * 顶层模块路由（避免 `/financial/...` 被 catch-all 误判 module=financial 而 404，
 * 与 chart-of-accounts / journal-entries-new / posting-engine 同因）：
 *   `/transaction-event-configuration`                       → list（Normalization Book 列表）
 *   `/transaction-event-configuration/mapping-rule?id=`      → detail 分支：Mapping Rule 列表
 *   `/transaction-event-configuration/mapping-rule/edit?id=`→ detail 分支：Mapping Rule 编辑
 *   `/transaction-event-configuration/mapping-rule/view?id=`→ detail 分支：Mapping Rule 详情
 *
 * catch-all dispatcher 把 slug[0]（非 create/edit）统一映射为 pageKey=`detail`，
 * 故 Mapping Rule 的列表/编辑/详情共用 pageKey=`detail`，由 TxEventConfigDetailPage
 * 组件按 slug[1]（edit / view / 无）分支。
 */
export const manifest: ModuleManifest = {
  id: 'transaction-event-configuration',
  name: 'Transaction Event Configuration',
  icon: 'Settings2',
  routes: [
    {
      path: '/transaction-event-configuration',
      component: 'list',
      label: 'Normalization Books',
    },
    {
      path: '/transaction-event-configuration/mapping-rule',
      component: 'detail',
      label: 'Mapping Rules',
    },
    {
      path: '/transaction-event-configuration/mapping-rule/edit',
      component: 'detail',
      label: 'Edit Mapping Rule',
    },
    {
      path: '/transaction-event-configuration/mapping-rule/view',
      component: 'detail',
      label: 'Mapping Rule Detail',
    },
  ],
  permissions: ['transaction-event-configuration:detail'],
  i18nNamespace: 'modules.transaction-event-configuration',
};

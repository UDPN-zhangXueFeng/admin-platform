import type { ModuleManifest } from '@myorg/shared/model';

/**
 * Transaction Event Configuration 模块清单。
 *
 * 作为 `accounting` 分组下的子模块挂载（见 configs/stablecoin.json），路由按分组机制
 * 解析：第一段 `accounting` 是分组、第二段是模块：
 *   `/accounting/transaction-event-configuration`                       → list（Normalization Book 列表）
 *   `/accounting/transaction-event-configuration/mapping-rule?id=`      → detail 分支：Mapping Rule 列表
 *   `/accounting/transaction-event-configuration/mapping-rule/edit?id=` → detail 分支：Mapping Rule 编辑
 *   `/accounting/transaction-event-configuration/mapping-rule/view?id=` → detail 分支：Mapping Rule 详情
 *
 * catch-all dispatcher 把分组后的 slug[0]（非 create/edit）统一映射为 pageKey=`detail`，
 * 故 Mapping Rule 的列表/编辑/详情共用 pageKey=`detail`，由 TxEventConfigDetailPage
 * 组件按 slug[1]（edit / view / 无）分支。旧扁平路由
 * `/transaction-event-configuration...` 仍由 registry 兼容，但不再是规范路径。
 */
export const manifest: ModuleManifest = {
  id: 'transaction-event-configuration',
  name: 'Transaction Event Configuration',
  icon: 'Settings2',
  routes: [
    {
      path: '/accounting/transaction-event-configuration',
      component: 'list',
      label: 'Normalization Books',
    },
    {
      path: '/accounting/transaction-event-configuration/mapping-rule',
      component: 'detail',
      label: 'Mapping Rules',
    },
    {
      path: '/accounting/transaction-event-configuration/mapping-rule/edit',
      component: 'detail',
      label: 'Edit Mapping Rule',
    },
    {
      path: '/accounting/transaction-event-configuration/mapping-rule/view',
      component: 'detail',
      label: 'Mapping Rule Detail',
    },
  ],
  permissions: ['transaction-event-configuration:detail'],
  i18nNamespace: 'modules.transaction-event-configuration',
};

import type { ModuleManifest } from '@myorg/shared/model';

/**
 * Chart of Accounts 模块清单。
 *
 * 作为 `accounting` 分组下的子模块挂载（见 configs/stablecoin.json），
 * 路由按分组机制解析：第一段 `accounting` 是分组、第二段是模块：
 * `/accounting/chart-of-accounts` → moduleId=`chart-of-accounts`。
 * 旧扁平路由 `/chart-of-accounts` 仍由 registry 兼容，但不再是规范路径。
 */
export const manifest: ModuleManifest = {
  id: 'chart-of-accounts',
  name: 'Chart of Accounts',
  icon: 'BarChart3',
  routes: [
    {
      path: '/accounting/chart-of-accounts',
      component: 'list',
      label: 'Chart of Accounts',
    },
    {
      path: '/accounting/chart-of-accounts/view',
      component: 'detail',
      label: 'Chart of Accounts Detail',
    },
  ],
  permissions: [
    'chart-of-accounts:detail',
    'chart-of-accounts:edit',
    'chart-of-accounts:view-statements',
  ],
  i18nNamespace: 'modules.chart-of-accounts',
};

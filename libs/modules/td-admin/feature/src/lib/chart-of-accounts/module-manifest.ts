import type { ModuleManifest } from '@myorg/shared/model';

/**
 * Chart of Accounts 模块清单。
 *
 * 作为 `accounting` 分组下的子模块挂载（见 configs/stablecoin.json），
 * 但路由按顶层模块机制解析：`/chart-of-accounts` → moduleId=`chart-of-accounts`。
 */
export const manifest: ModuleManifest = {
  id: 'chart-of-accounts',
  name: 'Chart of Accounts',
  icon: 'BarChart3',
  routes: [
    {
      path: '/chart-of-accounts',
      component: 'list',
      label: 'Chart of Accounts',
    },
    {
      path: '/chart-of-accounts/view',
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

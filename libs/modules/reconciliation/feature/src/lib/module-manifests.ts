import type { ModuleManifest } from '@myorg/shared/model';
import { RECONCILIATION_PERMISSIONS } from '@myorg/modules/reconciliation/util';

/**
 * Reconciliation 模块清单（2 子模块，均挂 `modules.reconciliation` i18n 命名空间）。
 *
 * 拓扑：reconciliation 为「分组模块」（类比 wallet 分组），`/reconciliation/<child>`
 * 由 dispatcher 把 slug[0] 当子模块名解析为 realModule。两清单分别对应
 * module-registry 的 `real-time` / `reserve` 两项。
 *
 * stablecoin.json 已把 reconciliation 作分组（group: ""），2 子项 path 写死
 * /reconciliation/real-time + /reconciliation/reserve。
 */
export const realTimeManifest: ModuleManifest = {
  id: 'real-time',
  name: 'Real-time On-chain Data',
  icon: 'Building2',
  routes: [
    {
      path: '/reconciliation/real-time',
      component: 'list',
      label: 'Real-time On-chain Data',
    },
    {
      path: '/reconciliation/real-time/view',
      component: 'detail',
      label: 'Real-time On-chain Data Detail',
    },
  ],
  permissions: [RECONCILIATION_PERMISSIONS.VIEW],
  i18nNamespace: 'modules.reconciliation',
};

export const reserveManifest: ModuleManifest = {
  id: 'reserve',
  name: 'Real-time Reserve',
  icon: 'Building2',
  routes: [
    {
      path: '/reconciliation/reserve',
      component: 'list',
      label: 'Real-time Reserve',
    },
    {
      path: '/reconciliation/reserve/view',
      component: 'detail',
      label: 'Real-time Reserve Detail',
    },
  ],
  permissions: [RECONCILIATION_PERMISSIONS.VIEW],
  i18nNamespace: 'modules.reconciliation',
};

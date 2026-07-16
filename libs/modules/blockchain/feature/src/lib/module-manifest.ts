import type { ModuleManifest } from '@myorg/shared/model';

/**
 * Blockchain 分组模块 manifest 集合。
 *
 * blockchain 在 configs/stablecoin.json 中是分组菜单（/blockchain/<child>），
 * 对齐 sys group 范本：每个子模块各自 manifest，id 为子模块名，routes 的
 * component 用通用 key（list/detail/edit）。实际页面由
 * `[module]/[[...slug]]/page.tsx` 经 group 解析后加载。
 *
 * 子模块：deployment（合约部署记录）/ node（节点管理）/ smart-contract（智能合约包）。
 */

/** 合约部署记录子模块：/blockchain/deployment → list，/blockchain/deployment/view → detail。 */
export const deploymentManifest: ModuleManifest = {
  id: 'deployment',
  name: '合约部署记录',
  icon: 'Blocks',
  routes: [
    {
      path: '/blockchain/deployment',
      component: 'list',
      label: '合约部署记录',
      permission: 'blockchain:deployment:view',
    },
    {
      path: '/blockchain/deployment/view',
      component: 'detail',
      label: '部署详情',
      permission: 'blockchain:deployment:view',
    },
  ],
  permissions: ['blockchain:deployment:view'],
  i18nNamespace: 'modules.blockchain.deployment',
};

/** 节点管理子模块：/blockchain/node → list，/blockchain/node/edit → edit。 */
export const nodeManifest: ModuleManifest = {
  id: 'node',
  name: '节点管理',
  icon: 'Blocks',
  routes: [
    {
      path: '/blockchain/node',
      component: 'list',
      label: '节点管理',
      permission: 'blockchain:node:view',
    },
    {
      path: '/blockchain/node/edit',
      component: 'edit',
      label: '节点编辑',
      permission: 'blockchain:node:edit',
    },
  ],
  permissions: ['blockchain:node:view', 'blockchain:node:edit'],
  i18nNamespace: 'modules.blockchain.node',
};

/** 智能合约包子模块：/blockchain/smart-contract → list。 */
export const smartContractManifest: ModuleManifest = {
  id: 'smart-contract',
  name: '智能合约包',
  icon: 'Blocks',
  routes: [
    {
      path: '/blockchain/smart-contract',
      component: 'list',
      label: '智能合约包',
      permission: 'blockchain:smart-contract:view',
    },
  ],
  permissions: ['blockchain:smart-contract:view'],
  i18nNamespace: 'modules.blockchain.smart-contract',
};

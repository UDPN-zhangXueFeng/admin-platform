import type { ModuleManifest } from '@myorg/shared/model';

/**
 * pledge 分组模块 manifest 集合。
 *
 * pledge 在 configs 中是分组菜单（/pledge/<child>），对齐 cross-chain /
 * blockchain group 范本：group 容器**不进 registry**，每个子模块各自 manifest，
 * id 为子模块名（与 `[module]/[[...slug]]/page.tsx` 的 group 解析后 realModule 一致），
 * routes 的 component 用通用 key（list/detail/create/edit）。实际页面由
 * `[module]/[[...slug]]/page.tsx` 经 group 解析后按 realModule+pageKey 从
 * module-registry 加载。
 *
 * 子模块：asset-transaction（储备资产交易）/ reserve-asset-list（储备资产）。
 *
 * 路由映射（源 → 目标 pageKey）：
 * - asset-transaction/index（交易列表）→ /pledge/asset-transaction → list
 * - asset-transaction/edit（新建交易）→ /pledge/asset-transaction/create → create（edit→create）
 * - reserve-asset-list/index（储备资产列表）→ /pledge/reserve-asset-list → list
 * - reserve-asset-list/new-view（详情）→ /pledge/reserve-asset-list/<id> → detail（new-view→detail）
 * - reserve-asset-list/asset-ategory（新增资产类别）→ /pledge/reserve-asset-list/create → create
 *
 * 占位：pl-1 仅建骨架 + group 注册，页面组件由 pl-2~pl-10 填充（导出自占位页文件）。
 */

/** 储备资产交易子模块：/pledge/asset-transaction → list，/create → create（edit→create）。 */
export const assetTransactionManifest: ModuleManifest = {
  id: 'asset-transaction',
  name: '储备资产交易',
  icon: 'ArrowsLeftRight',
  routes: [
    {
      path: '/pledge/asset-transaction',
      component: 'list',
      label: '储备资产交易',
      permission: 'pledge:asset-transaction:view',
    },
    {
      path: '/pledge/asset-transaction/create',
      component: 'create',
      label: '新建交易',
      permission: 'pledge:asset-transaction:edit',
    },
  ],
  permissions: ['pledge:asset-transaction:view', 'pledge:asset-transaction:edit'],
  // 扁平 namespace：所有页面用 useTranslations('modules.pledge')，键为相对路径。
  // 不用子模块后缀（modules.pledge.asset-transaction），否则与页面调用矛盾导致 MISSING_MESSAGE。
  i18nNamespace: 'modules.pledge',
};

/** 储备资产子模块：/pledge/reserve-asset-list → list，/<id> → detail（new-view），/create → create（asset-ategory）。 */
export const reserveAssetListManifest: ModuleManifest = {
  id: 'reserve-asset-list',
  name: '储备资产',
  icon: 'Vault',
  routes: [
    {
      path: '/pledge/reserve-asset-list',
      component: 'list',
      label: '储备资产',
      permission: 'pledge:reserve-asset-list:view',
    },
    {
      path: '/pledge/reserve-asset-list/view',
      component: 'detail',
      label: '储备资产详情',
      permission: 'pledge:reserve-asset-list:view',
    },
    {
      path: '/pledge/reserve-asset-list/create',
      component: 'create',
      label: '新增资产类别',
      permission: 'pledge:reserve-asset-list:edit',
    },
  ],
  permissions: ['pledge:reserve-asset-list:view', 'pledge:reserve-asset-list:edit'],
  // 扁平 namespace：同 asset-transaction，所有页面用 useTranslations('modules.pledge')。
  i18nNamespace: 'modules.pledge',
};

import type { ModuleManifest } from '@myorg/shared/model';

/**
 * Cross-Chain 分组模块 manifest 集合。
 *
 * cross-chain 在 configs 中是分组菜单（/cross-chain/<child>），对齐 blockchain /
 * sys group 范本：group 容器**不进 registry**，每个子模块各自 manifest，id 为子模块名
 * （与 `[module]/[[...slug]]/page.tsx` 的 group 解析后 realModule 一致），routes 的
 * component 用通用 key（list/detail/edit）。实际页面由
 * `[module]/[[...slug]]/page.tsx` 经 group 解析后按 realModule+pageKey 从
 * module-registry 加载。
 *
 * 子模块：cross-chain-transactions（跨链交易记录）/ fx-rate（汇率）/
 * liquidity-pool（流动性池）/ rd-bridge（RD-Bridge 跨链桥）/ token-pair（代币对）。
 *
 * 源码内部跳转路径（全部命中本组子模块）：
 * - cross-chain-transactions/index → /cross-chain/cross-chain-transactions/view?transferId=
 * - fx-rate/index → /cross-chain/fx-rate/view?rateId=
 * - liquidity-pool/index → /cross-chain/liquidity-pool/edit（新增）/view?liquidityPoolId=/edit?liquidityPoolId=
 * - liquidity-pool/view → /cross-chain/cross-chain-transactions/view（行查看）/approval-manage/view（操作记录）
 * - rd-bridge/index → /cross-chain/rd-bridge/edit（注册）/view?crossChainId=/edit?crossChainId=
 * - token-pair/index → /cross-chain/token-pair/edit（新增）/view?tokenCrossChainId=/edit?tokenCrossChainId=
 * - token-pair/edit → /cross-chain/liquidity-pool/edit（无流动性池提示）
 * 跨模块 /approval-manage/view 由独立 approval-manage 模块承载（不在本组）。
 */

/** 跨链交易记录子模块：/cross-chain/cross-chain-transactions → list，/view → detail。 */
export const crossChainTransactionsManifest: ModuleManifest = {
  id: 'cross-chain-transactions',
  name: '跨链交易记录',
  icon: 'ArrowsLeftRight',
  routes: [
    {
      path: '/cross-chain/cross-chain-transactions',
      component: 'list',
      label: '跨链交易记录',
      permission: 'cross-chain:cross-chain-transactions:view',
    },
    {
      path: '/cross-chain/cross-chain-transactions/view',
      component: 'detail',
      label: '交易详情',
      permission: 'cross-chain:cross-chain-transactions:view',
    },
  ],
  permissions: ['cross-chain:cross-chain-transactions:view'],
  i18nNamespace: 'modules.cross-chain.cross-chain-transactions',
};

/** 汇率子模块：/cross-chain/fx-rate → list，/view → detail（detail 用 DataTable 呈现历史汇率分页）。 */
export const fxRateManifest: ModuleManifest = {
  id: 'fx-rate',
  name: '汇率',
  icon: 'CurrencyDollar',
  routes: [
    {
      path: '/cross-chain/fx-rate',
      component: 'list',
      label: '汇率',
      permission: 'cross-chain:fx-rate:view',
    },
    {
      path: '/cross-chain/fx-rate/view',
      component: 'detail',
      label: '汇率详情',
      permission: 'cross-chain:fx-rate:view',
    },
  ],
  permissions: ['cross-chain:fx-rate:view'],
  i18nNamespace: 'modules.cross-chain.fx-rate',
};

/** 流动性池子模块：/cross-chain/liquidity-pool → list，/view → detail，/edit → edit。 */
export const liquidityPoolManifest: ModuleManifest = {
  id: 'liquidity-pool',
  name: '流动性池',
  icon: 'Drop',
  routes: [
    {
      path: '/cross-chain/liquidity-pool',
      component: 'list',
      label: '流动性池',
      permission: 'cross-chain:liquidity-pool:view',
    },
    {
      path: '/cross-chain/liquidity-pool/view',
      component: 'detail',
      label: '流动性池详情',
      permission: 'cross-chain:liquidity-pool:view',
    },
    {
      path: '/cross-chain/liquidity-pool/edit',
      component: 'edit',
      label: '流动性池编辑',
      permission: 'cross-chain:liquidity-pool:edit',
    },
  ],
  permissions: ['cross-chain:liquidity-pool:view', 'cross-chain:liquidity-pool:edit'],
  i18nNamespace: 'modules.cross-chain.liquidity-pool',
};

/** RD-Bridge 子模块：/cross-chain/rd-bridge → list，/view → detail，/edit → edit。 */
export const rdBridgeManifest: ModuleManifest = {
  id: 'rd-bridge',
  name: 'RD-Bridge',
  icon: 'Bridge',
  routes: [
    {
      path: '/cross-chain/rd-bridge',
      component: 'list',
      label: 'RD-Bridge',
      permission: 'cross-chain:rd-bridge:view',
    },
    {
      path: '/cross-chain/rd-bridge/view',
      component: 'detail',
      label: 'RD-Bridge 详情',
      permission: 'cross-chain:rd-bridge:view',
    },
    {
      path: '/cross-chain/rd-bridge/edit',
      component: 'edit',
      label: 'RD-Bridge 编辑',
      permission: 'cross-chain:rd-bridge:edit',
    },
  ],
  permissions: ['cross-chain:rd-bridge:view', 'cross-chain:rd-bridge:edit'],
  i18nNamespace: 'modules.cross-chain.rd-bridge',
};

/** 代币对子模块：/cross-chain/token-pair → list，/view → detail，/edit → edit。 */
export const tokenPairManifest: ModuleManifest = {
  id: 'token-pair',
  name: '代币对',
  icon: 'Swap',
  routes: [
    {
      path: '/cross-chain/token-pair',
      component: 'list',
      label: '代币对',
      permission: 'cross-chain:token-pair:view',
    },
    {
      path: '/cross-chain/token-pair/view',
      component: 'detail',
      label: '代币对详情',
      permission: 'cross-chain:token-pair:view',
    },
    {
      path: '/cross-chain/token-pair/edit',
      component: 'edit',
      label: '代币对编辑',
      permission: 'cross-chain:token-pair:edit',
    },
  ],
  permissions: ['cross-chain:token-pair:view', 'cross-chain:token-pair:edit'],
  i18nNamespace: 'modules.cross-chain.token-pair',
};

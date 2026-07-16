import type { ModuleManifest } from '@myorg/shared/model';
import { WALLET_PERMISSIONS } from '@myorg/modules/wallet/util';

/**
 * Wallet 模块清单（3 子模块，均挂 `modules.wallet` i18n 命名空间）。
 *
 * 拓扑：wallet 为「分组模块」（类比 dispatcher 的 sys 分组），`/wallet/<child>` 由
 * dispatcher 把 slug[0] 当子模块名解析为 realModule。三清单分别对应 module-registry
 * 的 `wallet-type` / `user-wallet` / `operational-wallet` 三项。
 */

export const operationalWalletManifest: ModuleManifest = {
  id: 'operational-wallet',
  name: 'Operational Wallet',
  icon: 'Wallet',
  routes: [
    { path: '/wallet/operational-wallet', component: 'list', label: 'Operational Wallet' },
    {
      path: '/wallet/operational-wallet/view',
      component: 'detail',
      label: 'Operational Wallet Detail',
    },
  ],
  permissions: [WALLET_PERMISSIONS.OperationalWalletDetail],
  i18nNamespace: 'modules.wallet',
};

export const userWalletManifest: ModuleManifest = {
  id: 'user-wallet',
  name: 'User Wallet',
  icon: 'Wallet',
  routes: [
    { path: '/wallet/user-wallet', component: 'list', label: 'User Wallet' },
    {
      path: '/wallet/user-wallet/view',
      component: 'detail',
      label: 'User Wallet Detail',
    },
    {
      path: '/wallet/user-wallet/history',
      component: 'detail',
      label: 'User Wallet Authorization History',
    },
  ],
  permissions: [
    WALLET_PERMISSIONS.UserWalletDetail,
    WALLET_PERMISSIONS.UserWalletHistory,
  ],
  i18nNamespace: 'modules.wallet',
};

export const walletTypeManifest: ModuleManifest = {
  id: 'wallet-type',
  name: 'Wallet Type',
  icon: 'Wallet',
  routes: [
    { path: '/wallet/wallet-type', component: 'list', label: 'Wallet Type' },
    {
      path: '/wallet/wallet-type/view',
      component: 'detail',
      label: 'Wallet Type Detail',
    },
    {
      path: '/wallet/wallet-type/edit',
      component: 'edit',
      label: 'Wallet Type Form',
    },
  ],
  permissions: [
    WALLET_PERMISSIONS.WalletTypeDetail,
    WALLET_PERMISSIONS.WalletTypeEdit,
  ],
  i18nNamespace: 'modules.wallet',
};

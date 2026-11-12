import type { ModuleManifest } from '@myorg/shared/model';

export const transactionFlowManifest: ModuleManifest = {
  id: 'transaction-flow',
  name: 'Transaction Flow',
  icon: 'Newspaper',
  routes: [
    {
      path: '/transaction-flow',
      component: 'list',
      label: 'Transaction Flow',
    },
    {
      path: '/transaction-flow/stablecoin',
      component: 'list',
      label: 'Token Transactions',
    },
    {
      path: '/transaction-flow/kissen-transfer',
      component: 'kissen-transfer',
      label: 'Kissen Cross-Bank Records',
    },
    {
      path: '/transaction-flow/kissen-transfer/:id',
      component: 'kissen-transfer-detail',
      label: 'Kissen Cross-Bank Transfer Detail',
    },
  ],
  permissions: [],
  i18nNamespace: 'modules.transaction-flow',
};

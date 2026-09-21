import type { ModuleManifest } from '@myorg/shared/model';

export const policyManifest: ModuleManifest = {
  id: 'policy',
  name: 'Interest Policy',
  icon: 'Receipt',
  routes: [
    {
      path: '/interest/policy',
      component: 'list',
      label: 'Interest Policy List',
    },
    {
      path: '/interest/policy/view',
      component: 'detail',
      label: 'Interest Policy Detail',
    },
    {
      path: '/interest/policy/edit',
      component: 'edit',
      label: 'Interest Policy Edit',
    },
    {
      path: '/interest/policy/create',
      component: 'create',
      label: 'Interest Policy Create',
    },
  ],
  permissions: [],
  i18nNamespace: 'modules.interest',
};

export const accrualManifest: ModuleManifest = {
  id: 'accrual',
  name: 'Interest Accrual',
  icon: 'Receipt',
  routes: [
    {
      path: '/interest/accrual',
      component: 'list',
      label: 'Interest Accrual List',
    },
    {
      path: '/interest/accrual/view',
      component: 'detail',
      label: 'Interest Accrual Detail',
    },
  ],
  permissions: [],
  i18nNamespace: 'modules.interest',
};

export const transactionsManifest: ModuleManifest = {
  id: 'transactions',
  name: 'Interest Transactions',
  icon: 'Receipt',
  routes: [
    {
      path: '/interest/transactions',
      component: 'list',
      label: 'Interest Transactions List',
    },
    {
      path: '/interest/transactions/view',
      component: 'detail',
      label: 'Interest Transactions Detail',
    },
  ],
  permissions: [],
  i18nNamespace: 'modules.interest',
};

import type { ModuleManifest } from '@myorg/shared/model';

export const ruleManifest: ModuleManifest = {
  id: 'rule',
  name: 'Screening Rule',
  icon: 'LineChart',
  routes: [
    { path: '/screening-monitoring/rule', component: 'list', label: 'Screening Rules' },
    { path: '/screening-monitoring/rule/view', component: 'detail', label: 'Rule Detail' },
    { path: '/screening-monitoring/rule/edit', component: 'edit', label: 'Rule Edit (Custom)' },
    { path: '/screening-monitoring/rule/create', component: 'create', label: 'Rule Create (Custom)' },
  ],
  permissions: [],
  i18nNamespace: 'modules.screening-monitoring',
};

export const transactionMonitoringManifest: ModuleManifest = {
  id: 'transaction-monitoring',
  name: 'Transaction Monitoring',
  icon: 'LineChart',
  routes: [
    { path: '/screening-monitoring/transaction-monitoring', component: 'list', label: 'Suspicious Transactions' },
    { path: '/screening-monitoring/transaction-monitoring/view', component: 'detail', label: 'Transaction Detail' },
  ],
  permissions: [],
  i18nNamespace: 'modules.screening-monitoring',
};

export const screeningProvidersManifest: ModuleManifest = {
  id: 'screening-providers',
  name: 'Screening Providers',
  icon: 'LineChart',
  routes: [
    { path: '/screening-monitoring/screening-providers', component: 'list', label: 'Screening Providers' },
  ],
  permissions: [],
  i18nNamespace: 'modules.screening-providers',
};

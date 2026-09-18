import type { ModuleManifest } from '@myorg/shared/model';

/**
 * Key-Management module manifest.
 */
export const manifest: ModuleManifest = {
  id: 'key-management',
  name: 'Key Management',
  icon: 'Key',
  routes: [
    {
      path: '/key-management',
      component: 'list',
      label: 'Key-Signed Transactions',
    },
    {
      path: '/key-management/detail',
      component: 'detail',
      label: 'Transaction Detail',
    },
  ],
  permissions: ['key-management:read'],
  i18nNamespace: 'modules.key-management',
};

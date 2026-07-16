import type { ModuleManifest } from '@myorg/shared/model';

export const manifest: ModuleManifest = {
  id: 'sp-access',
  name: 'SP Access Management',
  icon: 'SlidersVertical',
  routes: [
    {
      path: '/sp-access',
      component: 'list',
      label: 'SP Access List',
    },
    {
      path: '/sp-access/create',
      component: 'create',
      label: 'Create Service Provider',
    },
    {
      path: '/sp-access/edit',
      component: 'edit',
      label: 'Edit Service Provider',
    },
    {
      path: '/sp-access/detail',
      component: 'detail',
      label: 'Service Provider Detail',
    },
  ],
  permissions: ['sp-access:read'],
  i18nNamespace: 'modules.sp-access',
};

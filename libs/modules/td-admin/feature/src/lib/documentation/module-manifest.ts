import type { ModuleManifest } from '@myorg/shared/model';

export const documentationManifest: ModuleManifest = {
  id: 'documentation',
  name: 'Documentation',
  icon: 'FileText',
  routes: [{ path: '/documentation', component: 'list', label: 'Documentation' }],
  permissions: [],
  i18nNamespace: 'modules.documentation',
};

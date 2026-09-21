import type { ModuleManifest } from '@myorg/shared/model';
export const statisticsReportsManifest: ModuleManifest = { id: 'statistics-reports', name: 'Statistics Reports', icon: 'TrendingUp', routes: [{ path: '/statistics-reports', component: 'list', label: 'Statistics Reports' }], permissions: [], i18nNamespace: 'modules.statistics-reports' };

import type { ModuleManifest } from '@myorg/shared/model';

/**
 * Suspense Adjustment module manifest.
 *
 * Suspense Adjustments (暂记户调账) manages clearing of suspense account
 * entries: list outstanding suspense records, submit adjustments, and review
 * adjustment history / approval status.
 *
 * Routes (catch-all dispatcher in apps/admin maps slug[0]):
 * - `/suspense-adjustment`           → list
 * - `/suspense-adjustment/view?id=`  → detail (suspense entry + history)
 * - `/suspense-adjustment/edit?id=`  → edit (new adjustment form)
 */
export const manifest: ModuleManifest = {
  id: 'suspense-adjustment',
  name: 'Suspense Adjustment',
  icon: 'BarChart3',
  routes: [
    { path: '/suspense-adjustment', component: 'list', label: 'Suspense Adjustment' },
  ],
  permissions: [
    'suspense-adjustment:read',
    'suspense-adjustment:adjust',
    'suspense-adjustment:view',
  ],
  i18nNamespace: 'modules.suspense-adjustment',
};

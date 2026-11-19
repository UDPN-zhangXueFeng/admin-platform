import type { ModuleManifest } from '@myorg/shared/model';

/**
 * Suspense Adjustment module manifest.
 *
 * Suspense Adjustments (暂记户调账) manages clearing of suspense account
 * entries: list outstanding suspense records, submit adjustments, and review
 * adjustment history / approval status.
 *
 * 作为 `accounting` 分组的子模块挂载：第一段 `accounting` 是分组、第二段是模块。
 * Routes (catch-all dispatcher in apps/admin maps the slug after the group):
 * - `/accounting/suspense-adjustment`           → list
 * - `/accounting/suspense-adjustment/view?id=`  → detail (suspense entry + history)
 * - `/accounting/suspense-adjustment/edit?id=`  → edit (new adjustment form)
 *
 * 旧扁平路由 `/suspense-adjustment...` 仍由 registry 兼容，但不再是规范路径。
 */
export const manifest: ModuleManifest = {
  id: 'suspense-adjustment',
  name: 'Suspense Adjustment',
  icon: 'BarChart3',
  routes: [
    { path: '/accounting/suspense-adjustment', component: 'list', label: 'Suspense Adjustment' },
  ],
  permissions: [
    'suspense-adjustment:read',
    'suspense-adjustment:adjust',
    'suspense-adjustment:view',
  ],
  i18nNamespace: 'modules.suspense-adjustment',
};

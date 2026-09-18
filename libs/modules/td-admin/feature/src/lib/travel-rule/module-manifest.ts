import type { ModuleManifest } from '@myorg/shared/model';

/**
 * Travel Rule module manifest — the module's "identity card".
 *
 * Declares routes, permissions, and metadata so the app shell
 * can register the module dynamically without hard-coding
 * travel-rule-specific logic in apps/admin.
 *
 * Travel Rule is a read-only transaction-flow view, so only a
 * `list` route is declared (no detail/create).
 */
export const manifest: ModuleManifest = {
  id: 'travel-rule',
  name: 'Travel Rule',
  icon: 'Plane',
  routes: [
    { path: '/travel-rule', component: 'list', label: 'Travel Rule' },
  ],
  permissions: ['travel-rule:read', 'travel-rule:write', 'travel-rule:delete'],
  i18nNamespace: 'modules.travel-rule',
};

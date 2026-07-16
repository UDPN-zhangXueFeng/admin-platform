import type { ModuleManifest } from '@myorg/shared/model';

/**
 * Order module manifest — the module's "identity card".
 *
 * Declares routes, permissions, and metadata so the app shell
 * can register the module dynamically without hard-coding
 * order-specific logic in apps/admin.
 */
export const manifest: ModuleManifest = {
  id: 'order',
  name: '订单管理',
  icon: 'ShoppingCart',
  routes: [
    { path: '/order', component: 'list', label: '订单列表' },
    { path: '/order/:id', component: 'detail', label: '订单详情' },
  ],
  permissions: ['order:read', 'order:write', 'order:delete'],
  i18nNamespace: 'modules.order',
};

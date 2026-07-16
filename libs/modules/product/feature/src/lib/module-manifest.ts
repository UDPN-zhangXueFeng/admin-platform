import type { ModuleManifest } from '@myorg/shared/model';

/**
 * 商品管理 module manifest — the module's "identity card".
 *
 * Declares routes, permissions, and metadata so the app shell
 * can register the module dynamically without hard-coding
 * product-specific logic in apps/admin.
 */
export const manifest: ModuleManifest = {
  id: 'product',
  name: '商品管理',
  icon: 'Package',
  routes: [
    { path: '/product', component: 'list', label: '商品管理列表' },
    { path: '/product/:id', component: 'detail', label: '商品管理详情' },
  ],
  permissions: ['product:read', 'product:write', 'product:delete'],
  i18nNamespace: 'modules.product',
};

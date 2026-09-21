import type { ModuleManifest } from '@myorg/shared/model';

/**
 * User module manifest — 模块"身份证"。
 *
 * module-registry 读取它构建动态路由 / 侧边栏 / 权限守卫。
 * 实际页面组件由 `[module]/[[...slug]]/page.tsx` 经 sys 分组路由解析后加载。
 *
 * 路由（基于 page.tsx 的 pageKey 逻辑，归属 sys 分组）：
 *   - /sys/user           → pageKey=list   → UserListPage
 *   - /sys/user/view      → pageKey=detail → UserDetailPage（userId 从 query 取）
 *   - /sys/user/edit      → pageKey=edit   → UserFormPage（编辑态，userId 从 query 取）
 *   - /sys/user/create    → pageKey=create → UserFormPage（新增态）
 */
export const manifest: ModuleManifest = {
  id: 'user',
  name: '用户管理',
  icon: 'Users',
  routes: [
    { path: '/sys/user', component: 'list', label: '用户管理' },
    { path: '/sys/user/view', component: 'detail', label: '用户详情' },
    { path: '/sys/user/edit', component: 'edit', label: '编辑用户' },
    { path: '/sys/user/create', component: 'create', label: '新增用户' },
  ],
  permissions: ['user:read', 'user:write', 'user:delete'],
  i18nNamespace: 'modules.user',
};

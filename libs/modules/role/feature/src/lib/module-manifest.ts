import type { ModuleManifest } from '@myorg/shared/model';

/**
 * Role module manifest — 模块"身份证"。
 *
 * module-registry 读取它构建动态路由 / 侧边栏 / 权限守卫。
 * 实际页面组件由 `[module]/[[...slug]]/page.tsx` 经 sys 分组路由解析后加载。
 *
 * 路由（基于 page.tsx 的 pageKey 逻辑）：
 *   - /sys/role           → pageKey=list   → RoleListPage
 *   - /sys/role/view      → pageKey=detail → RoleViewPage（roleId 从 query 取）
 *   - /sys/role/edit      → pageKey=edit   → RoleFormPage（编辑态，roleId 从 query 取）
 *   - /sys/role/create    → pageKey=create → RoleFormPage（新增态）
 */
export const manifest: ModuleManifest = {
  id: 'role',
  name: '角色管理',
  icon: 'Shield',
  routes: [
    { path: '/sys/role', component: 'list', label: '角色管理' },
    { path: '/sys/role/view', component: 'detail', label: '角色详情' },
    { path: '/sys/role/edit', component: 'edit', label: '编辑角色' },
    { path: '/sys/role/create', component: 'create', label: '新增角色' },
  ],
  permissions: ['role:read', 'role:write'],
  i18nNamespace: 'modules.role',
};

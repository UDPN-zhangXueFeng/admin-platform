import type { ModuleManifest } from '@myorg/shared/model';

/**
 * Workflow module manifest — 模块"身份证"（sys-workflow）。
 *
 * module-registry 读取它构建动态路由 / 侧边栏 / 权限守卫。
 * registry key='workflow'（与顶级 'Workflow Tasks' 占位不冲突，前者挂 /sys/workflow）。
 *
 * 路由（基于 page.tsx 的 sys 分组解析）：
 *   - /sys/workflow           → pageKey=list   → WorkflowListPage
 *   - /sys/workflow/view      → pageKey=detail → WorkflowViewPage（id 从 query 取）
 *   - /sys/workflow/edit      → pageKey=edit   → WorkflowFormPage（编辑态）
 *   - /sys/workflow/create    → pageKey=create → WorkflowFormPage（新增态）
 *
 * edit+create 共用 WorkflowFormPage（add/edit 二合一，对齐 role）。
 */
export const manifest: ModuleManifest = {
  id: 'workflow',
  name: '审批工作流',
  icon: 'Workflow',
  routes: [
    { path: '/sys/workflow', component: 'list', label: '审批工作流' },
    { path: '/sys/workflow/view', component: 'detail', label: '工作流详情' },
    { path: '/sys/workflow/edit', component: 'edit', label: '编辑工作流' },
    { path: '/sys/workflow/create', component: 'create', label: '新增工作流' },
  ],
  permissions: ['workflow:read', 'workflow:write'],
  i18nNamespace: 'modules.workflow',
};

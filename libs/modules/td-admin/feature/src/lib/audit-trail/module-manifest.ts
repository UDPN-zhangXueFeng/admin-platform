import type { ModuleManifest } from '@myorg/shared/model';

/**
 * Audit Trail module manifest.
 *
 * 审计追踪：记录财务接口的请求/响应。列表（筛选 + 导出）+ 详情（kv + logList Timeline JSON）。
 * 作为 `accounting` 分组的子模块挂载：第一段 `accounting` 是分组、第二段是模块。
 * 路由：/accounting/audit-trail(list) / /accounting/audit-trail/view?id=traceId(detail)。
 * 旧扁平路由 `/audit-trail...` 仍由 registry 兼容，但不再是规范路径。
 */
export const manifest: ModuleManifest = {
  id: 'audit-trail',
  name: 'Audit Trail',
  icon: 'FileSearch',
  routes: [
    { path: '/accounting/audit-trail', component: 'list', label: 'Audit Trail' },
  ],
  permissions: ['audit-trail:read', 'audit-trail:export'],
  i18nNamespace: 'modules.audit-trail',
};

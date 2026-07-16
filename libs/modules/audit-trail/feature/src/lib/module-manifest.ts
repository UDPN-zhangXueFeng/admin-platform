import type { ModuleManifest } from '@myorg/shared/model';

/**
 * Audit Trail module manifest.
 *
 * 审计追踪：记录财务接口的请求/响应。列表（筛选 + 导出）+ 详情（kv + logList Timeline JSON）。
 * 路由：/audit-trail(list) / /audit-trail/view?id=traceId(detail)。
 */
export const manifest: ModuleManifest = {
  id: 'audit-trail',
  name: 'Audit Trail',
  icon: 'FileSearch',
  routes: [
    { path: '/audit-trail', component: 'list', label: 'Audit Trail' },
  ],
  permissions: ['audit-trail:read', 'audit-trail:export'],
  i18nNamespace: 'modules.audit-trail',
};

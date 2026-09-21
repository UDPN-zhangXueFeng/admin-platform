import type { ModuleManifest } from '@myorg/shared/model';

/** Statements module manifest — 导出报表规则管理（列表+新建Drawer/我的导出/规则详情+历史文件下载）。 */
export const manifest: ModuleManifest = {
  id: 'statements',
  name: 'Statements',
  icon: 'FileText',
  routes: [{ path: '/statements', component: 'list', label: 'Statements' }],
  permissions: ['statements:read', 'statements:rule:operate', 'statements:export'],
  i18nNamespace: 'modules.statements',
};

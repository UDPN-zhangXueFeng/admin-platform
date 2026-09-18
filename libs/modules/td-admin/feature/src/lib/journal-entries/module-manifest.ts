import type { ModuleManifest } from '@myorg/shared/model';

/** Journal Entries (旧版 Bill Rule 记账规则) manifest — 列表+详情+编辑(动态表单)。与 journal-entries-new(日记账条目)不同业务。 */
export const manifest: ModuleManifest = {
  id: 'journal-entries',
  name: 'Journal Entries',
  icon: 'BookOpen',
  routes: [{ path: '/journal-entries', component: 'list', label: 'Journal Entries' }],
  permissions: ['journal-entries:read', 'journal-entries:edit', 'journal-entries:operate'],
  i18nNamespace: 'modules.journal-entries',
};

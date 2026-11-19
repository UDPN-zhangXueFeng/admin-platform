import type { ModuleManifest } from '@myorg/shared/model';

/**
 * Journal Entries New 模块清单。
 *
 * 作为 `accounting` 分组下的子模块挂载（见 configs/stablecoin.json），路由按分组机制
 * 解析：第一段 `accounting` 是分组、第二段是模块：
 * `/accounting/journal-entries-new` → moduleId=`journal-entries-new`。
 * 详情页 `/accounting/journal-entries-new/view?tdTxId=...`（分组后的 slug[0]=view → detail）。
 * 旧扁平路由 `/journal-entries-new...` 仍由 registry 兼容，但不再是规范路径。
 */
export const manifest: ModuleManifest = {
  id: 'journal-entries-new',
  name: 'Journal Entries',
  icon: 'BarChart3',
  routes: [
    {
      path: '/accounting/journal-entries-new',
      component: 'list',
      label: 'Journal Entries',
    },
    {
      path: '/accounting/journal-entries-new/view',
      component: 'detail',
      label: 'Journal Entries Detail',
    },
  ],
  permissions: ['journal-entries-new:detail'],
  i18nNamespace: 'modules.journal-entries-new',
};

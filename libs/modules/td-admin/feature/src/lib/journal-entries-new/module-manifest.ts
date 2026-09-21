import type { ModuleManifest } from '@myorg/shared/model';

/**
 * Journal Entries New 模块清单。
 *
 * 作为 `accounting` 分组下的子模块挂载（见 configs/stablecoin.json），但路由按
 * 顶层模块机制解析：`/journal-entries-new` → moduleId=`journal-entries-new`。
 * 详情页 `/journal-entries-new/view?tdTxId=...`（slug[0]=view → detail）。
 * 与 chart-of-accounts 同为顶层模块（避免 `/financial/...` 被 catch-all 误判 module=financial 而 404）。
 */
export const manifest: ModuleManifest = {
  id: 'journal-entries-new',
  name: 'Journal Entries',
  icon: 'BarChart3',
  routes: [
    {
      path: '/journal-entries-new',
      component: 'list',
      label: 'Journal Entries',
    },
    {
      path: '/journal-entries-new/view',
      component: 'detail',
      label: 'Journal Entries Detail',
    },
  ],
  permissions: ['journal-entries-new:detail'],
  i18nNamespace: 'modules.journal-entries-new',
};

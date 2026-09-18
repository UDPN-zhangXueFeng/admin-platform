import type { ModuleManifest } from '@myorg/shared/model';

/**
 * Posting Engine 模块清单。
 *
 * 顶层模块路由（避免 `/financial/...` 被 catch-all 误判 module=financial 而 404，
 * 与 chart-of-accounts / journal-entries-new 同因）：
 *   `/posting-engine`          → list（账本列表）
 *   `/posting-engine/book?id=` → detail 分支：账本详情（Basic + Matrix-of-events）
 *   `/posting-engine/view?id=` → detail 分支：事件详情（Basic + Version History）
 *   `/posting-engine/edit?id=` → edit（事件矩阵编辑）
 *
 * catch-all dispatcher 把 slug[0] 映射为固定 pageKey（list/create/edit/detail），
 * 故「账本详情」与「事件详情」共用 pageKey=`detail`，由 PostingEngineDetailPage
 * 组件按 slug[0]（book / view）分支。
 */
export const manifest: ModuleManifest = {
  id: 'posting-engine',
  name: 'Posting Engine',
  // icon 占位（复用已验证可用的 lucide 图标，Phase 7 可调）
  icon: 'BarChart3',
  routes: [
    {
      path: '/posting-engine',
      component: 'list',
      label: 'Posting Engine',
    },
    {
      path: '/posting-engine/book',
      component: 'detail',
      label: 'Posting Engine Book Detail',
    },
    {
      path: '/posting-engine/view',
      component: 'detail',
      label: 'Posting Engine Event View',
    },
    {
      path: '/posting-engine/edit',
      component: 'edit',
      label: 'Posting Engine Event Edit',
    },
  ],
  permissions: ['posting-engine:detail', 'posting-engine:edit'],
  i18nNamespace: 'modules.posting-engine',
};

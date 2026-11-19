import type { ModuleManifest } from '@myorg/shared/model';

/**
 * Posting Engine 模块清单。
 *
 * 作为 `accounting` 分组下的子模块挂载（见 configs/stablecoin.json），路由按分组机制
 * 解析：第一段 `accounting` 是分组、第二段是模块：
 *   `/accounting/posting-engine`          → list（账本列表）
 *   `/accounting/posting-engine/book?id=` → detail 分支：账本详情（Basic + Matrix-of-events）
 *   `/accounting/posting-engine/view?id=` → detail 分支：事件详情（Basic + Version History）
 *   `/accounting/posting-engine/edit?id=` → edit（事件矩阵编辑）
 *
 * catch-all dispatcher 把分组后的 slug[0] 映射为固定 pageKey（list/create/edit/detail），
 * 故「账本详情」与「事件详情」共用 pageKey=`detail`，由 PostingEngineDetailPage
 * 组件按 slug[0]（book / view）分支。旧扁平路由 `/posting-engine...` 仍由 registry
 * 兼容，但不再是规范路径。
 */
export const manifest: ModuleManifest = {
  id: 'posting-engine',
  name: 'Posting Engine',
  // icon 占位（复用已验证可用的 lucide 图标，Phase 7 可调）
  icon: 'BarChart3',
  routes: [
    {
      path: '/accounting/posting-engine',
      component: 'list',
      label: 'Posting Engine',
    },
    {
      path: '/accounting/posting-engine/book',
      component: 'detail',
      label: 'Posting Engine Book Detail',
    },
    {
      path: '/accounting/posting-engine/view',
      component: 'detail',
      label: 'Posting Engine Event View',
    },
    {
      path: '/accounting/posting-engine/edit',
      component: 'edit',
      label: 'Posting Engine Event Edit',
    },
  ],
  permissions: ['posting-engine:detail', 'posting-engine:edit'],
  i18nNamespace: 'modules.posting-engine',
};

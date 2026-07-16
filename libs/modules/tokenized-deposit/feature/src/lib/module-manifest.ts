import type { ModuleManifest } from '@myorg/shared/model';
import { TD_PERMISSIONS } from '@myorg/modules/tokenized-deposit/util';

/**
 * tokenized-deposit 单模块 manifest（方案 A，非 group）。
 *
 * 菜单为 configs/stablecoin.json 中 group:"more" 下的顶层项（icon Ticket,
 * path /tokenized-deposit），无子菜单。路由由通用 catch-all
 * `apps/admin/src/app/[locale]/(app)/[module]/[[...slug]]/page.tsx` 提供：
 *   /tokenized-deposit          → slug=[]      → pageKey "list"    → OverviewPage
 *   /tokenized-deposit/view     → slug=[view]  → pageKey "detail"  → ViewPage
 *   /tokenized-deposit/edit     → slug=[edit]  → pageKey "edit"    → EditPage
 *   /tokenized-deposit/onboard  → slug=[onboard]→ pageKey "onboard" → OnboardPage(add 态薄壳)
 *   /tokenized-deposit/edit     → slug=[edit]  → pageKey "edit"    → EditPage(edit 态薄壳)
 *
 * 注意：OnboardPage/EditPage 均为薄壳，共享 `tokenized-deposit-form-content.tsx` 内核
 * （mode='add'|'edit'），逻辑零重复。add/edit 拆为两个独立路由/页面，不再用 query.code
 * 在同页切换。registry pageKey 已从 'create' 改为 'onboard'。
 *
 * list route permission 用 VIEW_RECORD（铸销记录查看，源 customTable View 权限码），
 * 与源码 index 首屏可见性对齐。permissions 汇总 TD_PERMISSIONS 全量（17 核心 + 2 合约
 * 内联按钮 + 2 onboard 入口 = 19 项，供权限聚合视图消费）。
 */
export const manifest: ModuleManifest = {
  id: 'tokenized-deposit',
  name: 'Tokenized Deposit',
  icon: 'Ticket',
  routes: [
    {
      path: '/tokenized-deposit',
      component: 'list',
      label: 'Tokenized Deposit',
      permission: TD_PERMISSIONS.VIEW_RECORD,
    },
    {
      path: '/tokenized-deposit/view',
      component: 'detail',
      label: 'Detail',
    },
    {
      path: '/tokenized-deposit/edit',
      component: 'edit',
      label: 'Edit',
    },
    {
      path: '/tokenized-deposit/onboard',
      component: 'onboard',
      label: 'Onboard',
    },
  ],
  permissions: [...Object.values(TD_PERMISSIONS)],
  i18nNamespace: 'modules.tokenized-deposit',
};

import type { ModuleManifest } from '@myorg/shared/model';

/**
 * MMF 分组模块 manifest 集合。
 *
 * mmf 在 configs/stablecoin.json 中是分组菜单（/mmf/<child>），对齐 sys group
 * 范本：每个子模块各自 manifest，id 为子模块名，routes 的 component 用通用 key
 * （list/detail）。实际页面由 `[module]/[[...slug]]/page.tsx` 经 group 解析后加载。
 *
 * 与 sys role（/sys/role/view?...=）的 query 取参方式不同，mmf 详情页沿用源码
 * td-manage 的路径段 id 约定（/mmf/accrual/:id）—— 详情页通过 useParams().id 取值，
 * 列表页 router.push(`/mmf/accrual/${id}`)。pageKey 推导：:id 非 create/edit → detail。
 *
 * 子模块：accrual（分红计提）/ settlement（分红结算）。
 */

/** 分红计提子模块：/mmf/accrual → list，/mmf/accrual/:id → detail。 */
export const accrualManifest: ModuleManifest = {
  id: 'accrual',
  name: '分红计提',
  icon: 'Coins',
  routes: [
    {
      path: '/mmf/accrual',
      component: 'list',
      label: '分红计提',
      permission: 'mmf:accrual:view',
    },
    {
      path: '/mmf/accrual/:id',
      component: 'detail',
      label: '计提详情',
      permission: 'mmf:accrual:view',
    },
  ],
  permissions: ['mmf:accrual:view', 'mmf:accrual:apply'],
  i18nNamespace: 'modules.mmf.accrual',
};

/** 分红结算子模块：/mmf/settlement → list，/mmf/settlement/:id → detail。 */
export const settlementManifest: ModuleManifest = {
  id: 'settlement',
  name: '分红结算',
  icon: 'Coins',
  routes: [
    {
      path: '/mmf/settlement',
      component: 'list',
      label: '分红结算',
      permission: 'mmf:settlement:view',
    },
    {
      path: '/mmf/settlement/:id',
      component: 'detail',
      label: '结算详情',
      permission: 'mmf:settlement:view',
    },
  ],
  permissions: ['mmf:settlement:view'],
  i18nNamespace: 'modules.mmf.settlement',
};

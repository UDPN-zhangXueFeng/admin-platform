/**
 * @myorg/modules/lp-portal/data-access
 *
 * LP Portal data-access barrel：lp-client 基础设施 + 公共源类型 + 各业务域
 * （auth / pool / rate / pair / tx-flow / settle / user / menu /
 * log / role）五件套聚合。
 */
export {
  LP_PROJECT_ID,
  lpAxios,
  lpRequest,
  lpPage,
  LpApiError,
  isServiceDown,
  SERVICE_DOWN_CODE,
  type LpRequest,
  type LpResult,
  type LpPageResult,
  type LpPageReq,
} from './lib/lp-client';

/**
 * 公共源类型（Vue 源 types/* 的全量平移，供各域消费）。
 * 注意：同名类型与域 model 存在双声明时，两个 `export *` 的同名歧义
 * （TS2308）会使该名字从 barrel 静默消失。故以文件尾显式重导出锚定
 * 域 model 版本（显式导出优先于 star 导出）。
 *
 * 其余域（pair / tx-flow / settle / user / menu / log / pool / token）model
 * 改用 `export type { X } from '../types'` 重导出同一声明——两路 star 导出
 * 指向同一 symbol，不构成歧义，types.ts 中同名类型无需剪除（逐域核查过，
 * 见各域 model 头注释）。
 */
export * from './lib/types';
export * from './lib/auth';
export * from './lib/pool';
export * from './lib/rate';
export * from './lib/pair';
export * from './lib/tx-flow';
export * from './lib/settle';
export * from './lib/user';
export * from './lib/menu';
export * from './lib/log';

// 角色域（R3：C2 角色管理页 + user 页角色选项薄切片并入 useRoleOptionsQuery）。
export * from './lib/role';

// 市场组新增域（G2）：Token 总览 + 数据同步刷新（sync-refresh-button 消费）。
export * from './lib/token';
export * from './lib/sync';

// 流动性组新增域（G3）：预授权快照 + 我的分成（只读，无 mutations）。
export * from './lib/preauth';
export * from './lib/split';

// 壳层通知域（G6）：Header 铃铛抽屉消费（五件套 + markRead mutations）。
export * from './lib/notification';

// 显式锚定域 model 版本，消解与 types.ts star 导出的同名歧义（见上）；
// pool 的 PoolRow 形状随 v2 契约更新（tokenNo/bankCode/rejectReason 等），
// types.ts 旧形态已剪除。
export { type PoolRow } from './lib/pool';

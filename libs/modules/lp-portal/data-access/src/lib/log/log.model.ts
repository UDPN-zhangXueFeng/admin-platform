/**
 * LP 系统操作日志域模型（源 `types/system.ts` 日志段）。
 *
 * 行/请求 VO 集中定义在 `../types`（源 1:1 平移，barrel 已 star 导出），
 * 此处仅重导出同一声明，不重复定义（避免 pool 域曾出现的同名歧义）。
 * BIZ_TEXT/BIZ_TAG 为源 `views/system/log/index.vue` 码表 1:1 平移；
 * TAG 值保持源 el-tag type（data-access 不依赖 UI 库），页面负责映射 Badge。
 */
import type { LogListReq } from '../types';

export type { LogRow, LogListReq } from '../types';

/** 日志页分页入参（hook 消费形状，对齐 topup 域先例）。 */
export interface LogPageReq {
  pageNum: number;
  pageSize: number;
  filter?: LogListReq;
}

/** 业务类型文案（源 BIZ_TEXT 码表 1〜5；未知码页面显原值）。 */
export const LOG_BIZ_TEXT: Record<number, string> = {
  1: 'Create',
  2: 'Update',
  3: 'Delete',
  4: 'Login',
  5: 'Other',
};

/** 业务类型 tag 色（源 BIZ_TAG 码表 1〜5，el-tag type 原值）。 */
export const LOG_BIZ_TAG: Record<number, 'primary' | 'warning' | 'danger' | 'success' | 'info'> = {
  1: 'primary',
  2: 'warning',
  3: 'danger',
  4: 'success',
  5: 'info',
};

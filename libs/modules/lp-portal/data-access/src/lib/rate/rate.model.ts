/**
 * rate 域模型（源 `src/views/rate/index.vue` + `src/api/rate.ts`）。
 *
 * 行类型 {@link RateRow} 已在公共 `../types` 定义（POST /lp/rate/list 不分页
 * 全量返回），本域仅补充视图级状态映射与请求类型，避免重复声明。
 */
import type { RateRow } from '../types';

export type { RateRow };

/**
 * 汇率列表请求（源 `api/rate.ts` list：`req: { pairId?: number } = {}`）。
 * pairId 入参保留但汇率页从不传——全量拉取后客户端过滤，不发二次请求；
 * lpId 由 BFF 登录域注入，前端不传。
 */
export interface RateListReq {
  pairId?: number;
}

/**
 * 货币对状态文案：20 启用 / 50 停用；其他码值兜底显原值（码表联调对齐）。
 * 源 `PAIR_STATUS_TEXT` + `pairStatusText` 兜底 `String(s)`。
 */
export const RATE_PAIR_STATUS_LABEL: Record<number, string> = {
  20: 'Enabled',
  50: 'Disabled',
};

/** 货币对状态 → Badge variant（源 el-tag：20 success / 其他 info）。 */
export const RATE_PAIR_STATUS_VARIANT: Record<
  number,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  20: 'default',
};

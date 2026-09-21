/**
 * LP Portal 结算域模型（源 `src/types/business.ts` SettleRecordRow /
 * SettleOrderRow / SettleOrderItem / SettleOrderListReq +
 * `src/views/split-settle/index.vue` 码表，v2.4 6c49396 合并页口径）。
 *
 * 行/筛选类型已在公共源类型 `../types` 全量平移，本域 re-export 同一声明
 * （barrel 两路 star 导出指向同一 symbol 不产生歧义），域内仅新增分页
 * hook 入参形状与状态/周期码表。
 *
 * 端点：POST /lp/settle/orders（结算单分页，含分项 items 与币种集合；
 * v2.4 起筛选 periodType/status 数字码）、POST /lp/settle/order-records
 * （单据周期内结算流水，合并页详情抽屉按需拉取；v2.4 取代独立分页端点
 * /settle/records）。lpId 由 BFF 登录域注入，前端不传。纯只读（状态机
 * 仅展示，页面不触发流转）。
 */
import type { SettleOrderListReq } from '../types';

export type {
  SettleOrderListReq,
  SettleOrderRow,
  SettleOrderItem,
  SettleRecordRow,
} from '../types';

/** 结算单分页查询 hook 入参（filter 序列化进请求 `data` 包）。 */
export interface SettleOrdersQuery {
  pageNum: number;
  pageSize: number;
  filter: SettleOrderListReq;
}

/**
 * 结算单状态文案（源 ORDER_STATUS_TEXT：10 待确认 / 20 已确认 /
 * 35 已结算 / 45 已作废重开；v2.4 取代旧 5/10/15 码表；未知码页面显原值）。
 */
export const SETTLE_ORDER_STATUS_LABEL: Record<number, string> = {
  10: 'Pending Confirmation',
  20: 'Confirmed',
  35: 'Settled',
  45: 'Voided & Reopened',
};

/**
 * 结算单状态 → Badge variant（源 el-tag：35 success / 20 primary /
 * 45 danger / 其余(10) warning）。Badge 无 warning/success/primary 变体，
 * 按 R1 映射先例：success→default、primary→secondary、danger→destructive、
 * warning→outline；未知码兜底 secondary 由页面处理。
 */
export const SETTLE_ORDER_STATUS_VARIANT: Record<
  number,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  10: 'outline',
  20: 'secondary',
  35: 'default',
  45: 'destructive',
};

/** 周期粒度文案（源 PERIOD_TYPE_MAP：1 日 / 2 周 / 3 月；未知码页面显原值）。 */
export const SETTLE_PERIOD_TYPE_LABEL: Record<number, string> = {
  1: 'Daily',
  2: 'Weekly',
  3: 'Monthly',
};

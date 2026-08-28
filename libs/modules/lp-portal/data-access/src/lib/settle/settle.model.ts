/**
 * LP Portal 结算域模型（源 `src/types/business.ts` SettleRecordRow /
 * SettleOrderRow / SettleRecordListReq / SettleOrderListReq +
 * `src/views/settle/index.vue` 码表）。
 *
 * 行/筛选类型已在公共源类型 `../types` 全量平移，本域 re-export 同一声明
 * （barrel 两路 star 导出指向同一 symbol 不产生歧义，无需显式锚定），
 * 域内仅新增分页 hook 入参形状与状态/周期码表。
 *
 * 端点：POST /lp/settle/records（结算流水，筛选仅时间范围——records 表无
 * 周期列，裁决 C-1）、POST /lp/settle/orders（结算单，周期筛选入参 cycle
 * 由后端映射 period_type 1/2/3，裁决 C-1/D-7）。lpId 由 BFF 登录域注入，
 * 前端不传。结算页纯只读（裁决 C-2：状态机仅展示，不触发流转）。
 */
import type {
  SettleOrderListReq,
  SettleRecordListReq,
} from '../types';

export type {
  SettleOrderListReq,
  SettleOrderRow,
  SettleRecordListReq,
  SettleRecordRow,
} from '../types';

/** 结算流水分页查询 hook 入参（filter 序列化进请求 `data` 包）。 */
export interface SettleRecordsQuery {
  pageNum: number;
  pageSize: number;
  filter: SettleRecordListReq;
}

/** 结算单分页查询 hook 入参（filter 序列化进请求 `data` 包）。 */
export interface SettleOrdersQuery {
  pageNum: number;
  pageSize: number;
  filter: SettleOrderListReq;
}


/** 结算单状态文案（源 ORDER_STATUS_MAP；裁决 C-2：5/10 均「生成」，15 拒绝，20 已确认，35 已结算）。 */
export const SETTLE_ORDER_STATUS_LABEL: Record<number, string> = {
  5: 'Generated',
  10: 'Generated',
  15: 'Rejected',
  20: 'Confirmed',
  35: 'Settled',
};

/**
 * 结算单状态 → Badge variant（源 el-tag 分层：15 danger / 20 warning /
 * 35 success / 其余(5/10) info）。Badge 无 warning 变体，取 destructive /
 * default 之外的 outline 表达 20（warning），与 35（success→default）保持
 * 源的三层视觉区分；5/10（info）→ secondary；未知码兜底 secondary 由页面处理。
 */
export const SETTLE_ORDER_STATUS_VARIANT: Record<
  number,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  5: 'secondary',
  10: 'secondary',
  15: 'destructive',
  20: 'outline',
  35: 'default',
};

/** 周期粒度文案（源 PERIOD_TYPE_MAP：1 日 / 2 周 / 3 月；未知码页面显原值）。 */
export const SETTLE_PERIOD_TYPE_LABEL: Record<number, string> = {
  1: 'Daily',
  2: 'Weekly',
  3: 'Monthly',
};

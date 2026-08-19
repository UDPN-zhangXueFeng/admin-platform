/**
 * LP Portal 补资域模型（源 `src/types/business.ts` TopupRow/TopupListReq +
 * `src/views/topup/index.vue` TOPUP_STATUS_TEXT/TOPUP_STATUS_TAG）。
 *
 * 端点：POST /lp/topup/list（分页，后端默认 declare_time DESC，前端不传排序，
 * 裁决 C-12；lpId 由 BFF 登录域注入，前端不传）。
 */

/** 补资记录行（源 types/business.ts TopupRow）。 */
export interface TopupRow {
  topupId: number;
  poolId: number;
  currency: string;
  amount: number;
  transferInAddress: string;
  declareTime: number;
  /** 0 = 未到账（展示按 falsy → '-'） */
  confirmTime: number;
  csTxId?: string;
  /** 1 已声明 / 2 已到账 / 3 失败 */
  status: number;
}

/** 补资列表筛选（源 TopupListReq；默认全空 = 不过滤，时间戳为毫秒 number）。 */
export interface TopupListFilter {
  poolId?: number;
  /** 1 已声明 / 2 已到账 / 3 失败 */
  status?: number;
  startTime?: number;
  endTime?: number;
}

/** 补资列表请求（query hook 入参；filter 序列化进 `data` 包）。 */
export interface TopupListReq {
  pageNum: number;
  pageSize: number;
  filter: TopupListFilter;
}

/** 补资状态文案（源 views/topup TOPUP_STATUS_TEXT；未知码显原值兜底在页面）。 */
export const TOPUP_STATUS_LABEL: Record<number, string> = {
  1: 'Declared',
  2: 'Received',
  3: 'Failed',
};

/**
 * 补资状态 Badge 变体（源 el-tag type：1 primary / 2 success / 3 danger，
 * 兜底 info）。Badge 无 primary/success/info 变体，按视觉语义映射并对齐
 * kissen-admin lp-topup 先例：primary→default、success→default、danger→destructive。
 */
export const TOPUP_STATUS_VARIANT: Record<
  number,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  1: 'secondary',
  2: 'default',
  3: 'destructive',
};

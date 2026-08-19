/** 汇率加价率变更记录模型（源 `api/rate.ts` RateRecordRow）。 */

/**
 * 加价率变更记录行（与后端 RateRecordRespVO 对齐；fx_rate_config_record 联查货币对）。
 * rowKey 为 `recordId`。
 */
export interface RateRecordRow {
  recordId: number;
  pairId: number;
  sourceCurrency: string;
  targetCurrency: string;
  oldMarkupRate: string | number;
  newMarkupRate: string | number;
  /** 1 新增 / 2 修改。 */
  changeType: number;
  approvalRecordId: number;
  /** 本域语义：5 待生效 / 20 已生效 / 15 已关闭（文案复用通用状态映射）。 */
  status: number;
  createTime: number;
}

export interface RateListFilter {
  pairId?: number;
  status?: number;
}

export interface RateListReq {
  pageNum: number;
  pageSize: number;
  filter: RateListFilter;
}

/** 提交加价率变更（KRC 审批）；仅启用(20)货币对可提交。源 `rateSave`。 */
export interface RateSaveReq {
  pairId: number;
  markupRate: string | number;
}

/** 基础汇率手工维护（FR-R-01）；写货币对现行生效记录；首版无审批立即生效。源 `exchangeRateSave`。 */
export interface ExchangeRateSaveReq {
  pairId: number;
  baseRate: string | number;
}

/** 变更类型映射（源 rate-history-dialog CHANGE_TYPE_MAP）。 */
export const RATE_CHANGE_TYPE_LABEL: Record<number, string> = {
  1: 'Created',
  2: 'Modified',
};

/**
 * 加价率变更记录状态文案（源 rate-history-dialog 语义：复用 COMMON_STATUS_MAP）。
 * 5 待生效 / 15 已关闭 / 20 已生效。
 */
export const RATE_STATUS_LABEL: Record<number, string> = {
  5: 'Pending',
  15: 'Closed',
  20: 'Effective',
};

/** 变更记录状态 → Badge variant。5 待生效=outline / 20 已生效=default / 15 已关闭=secondary。 */
export const RATE_STATUS_VARIANT: Record<
  number,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  5: 'outline',
  15: 'secondary',
  20: 'default',
};

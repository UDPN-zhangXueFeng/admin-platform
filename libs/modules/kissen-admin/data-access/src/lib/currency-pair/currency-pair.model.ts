/** 货币对模型（源 `api/currency-pair.ts` CurrencyPairRow / CurrencyPairSaveReq）。 */

/** 货币对列表行 / 详情（与后端 CurrencyPairRespVO 对齐）。rowKey 为 `pairId`。 */
export interface CurrencyPairRow {
  pairId: number;
  sourceCurrency: string;
  targetCurrency: string;
  markupRate: string | number;
  slippageThreshold: string | number;
  /** 1 保存(草稿) / 20 审核通过(启用) / 50 停用。 */
  status: number;
  /** 联查的现行生效基础汇率（null=未维护）。 */
  baseRate: string | number | null;
  createTime: number;
  /** 后端返回的待办动作文案（可选）。 */
  pendingAction?: string;
}

export interface CurrencyPairListFilter {
  sourceCurrency?: string;
  targetCurrency?: string;
  status?: number;
}

export interface CurrencyPairListReq {
  pageNum: number;
  pageSize: number;
  filter: CurrencyPairListFilter;
}

/**
 * 货币对保存请求（源 CurrencyPairSaveReqVO）。
 * pairId 空=新建（草稿 status=1），非空=编辑（source/target 不可改）。
 */
export interface CurrencyPairSaveReq {
  pairId?: number;
  sourceCurrency: string;
  targetCurrency: string;
  markupRate: string | number;
  /** 空则后端保留原值。 */
  slippageThreshold?: string | number;
}

export interface CurrencyPairIdReq {
  pairId: number;
}

/** 货币对状态枚举。 */
export const CurrencyPairStatus = {
  /** 保存(草稿)——新建或停用后可编辑。 */
  Draft: 1,
  /** 审核通过(启用)——参与报价。 */
  Enabled: 20,
  /** 停用——冻结或审批停用。 */
  Disabled: 50,
} as const;

/** 货币对状态文案（复用源 COMMON_STATUS_MAP 子集）。 */
export const CURRENCY_PAIR_STATUS_LABEL: Record<number, string> = {
  1: 'Saved (Draft)',
  20: 'Approved',
  50: 'Disabled',
};

/**
 * 货币对状态 → Badge variant（conventions §5）。
 * 20 启用=default / 1 草稿=outline / 50 停用=secondary。
 */
export const CURRENCY_PAIR_STATUS_VARIANT: Record<
  number,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  1: 'outline',
  20: 'default',
  50: 'secondary',
};

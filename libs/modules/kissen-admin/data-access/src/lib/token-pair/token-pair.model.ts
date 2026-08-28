/**
 * Token 对（源 `api/token-pair.ts`，v2.0-tokenization；rowKey=pairId）。
 *
 * 域模型换代（漂移表 fx-rate #1）：v1 currency-pair 的 sourceCurrency/targetCurrency
 * 字符串币种 → v2 token 对 sourceTokenId/targetTokenId + symbol 优先展示 + 银行副行；
 * 即时启停（20 启用 / 30 冻结 / 50 停用）；2023418 起建对/改参均走审批
 * （KPT 开通申请 / KRC 参数变更），状态含 5 待审 / 10 审核中 / 15 已驳回。
 */

export interface TokenPairRow {
  pairId: number;
  pairCode: string;
  sourceTokenId: number;
  sourceTokenCode: string;
  /** symbol 缩写（上游 787ccc9 展示口径：源/目标优先 symbol，缺省回退 code）。 */
  sourceSymbol: string;
  sourceBankCode: string;
  targetBankCode: string;
  targetTokenId: number;
  targetTokenCode: string;
  /** symbol 缩写（展示用，缺省回退 code）。 */
  targetSymbol: string;
  /** Base FX rate (list display; re-echoed into change/resubmit dialogs). */
  baseRate: string | number;
  /** Markup on top of the base rate (0.01 = 1%). */
  markupRate: string | number | null;
  /** Platform-side share of the markup (0–1 decimal; null = engine default). */
  defaultSplitRatio: string | number | null;
  /** Engine and existing values still apply, but the list/forms no longer render or accept it (01 §G ruling 13). */
  slippageThreshold: string | number;
  /** A pending KRC parameter-change request exists (source 2023418). */
  pendingChange: boolean;
  status: number;
  createTime: number;
}

/**
 * Opening request aligned with TokenPairSaveReqVO (source 2023418: save is a KPT
 * approval submission, not an instant create). Rejected combinations are
 * re-submitted on the same source+target row — the server recognizes them.
 */
export interface TokenPairSaveReq {
  sourceTokenId: number;
  targetTokenId: number;
  baseRate: string | number;
  markupRate?: string | number;
  defaultSplitRatio?: string | number;
  slippageThreshold?: string | number;
}

/** Parameter-change request (KRC approval, applied only once approved; source 2023418). */
export interface TokenPairChangeReq {
  pairId: number;
  baseRate?: string | number;
  markupRate?: string | number;
  defaultSplitRatio?: string | number;
}


/** 列表筛选（上游 pairList 入参；端点直返数组非分页）。 */
export interface TokenPairListFilter {
  pairId?: number;
  pairCode?: string;
  sourceTokenId?: number;
  targetTokenId?: number;
  status?: number;
}

export const PAIR_STATUS_LABEL: Record<number, string> = {
  5: 'Pending Approval',
  10: 'Under Review',
  15: 'Rejected',
  20: 'Enabled',
  30: 'Frozen',
  50: 'Disabled',
};

/**
 * Badge variant（conventions §5；2023418 色彩口径：20 default / 5+10+30
 * secondary / 15 destructive / 50 outline）。
 */
export const PAIR_STATUS_VARIANT: Record<
  number,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  5: 'secondary',
  10: 'secondary',
  15: 'destructive',
  20: 'default',
  30: 'secondary',
  50: 'outline',
};

/**
 * Token 对（源 `api/token-pair.ts`，v2.0-tokenization；rowKey=pairId）。
 *
 * 域模型换代（漂移表 fx-rate #1）：v1 currency-pair 的 sourceCurrency/targetCurrency
 * 字符串币种 → v2 token 对 sourceTokenId/targetTokenId + symbol 优先展示 + 银行副行；
 * 审批/草稿态退役，换即时启停（20 启用 / 30 冻结 / 50 停用）。
 */

export interface TokenPairRow {
  pairId: number;
  pairCode: string;
  sourceTokenId: number;
  sourceTokenCode: string;
  /** symbol 缩写（上游 787ccc9 展示口径：源/目标优先 symbol，缺省回退 code）。 */
  sourceSymbol: string;
  sourceBankCode: string;
  targetTokenId: number;
  targetTokenCode: string;
  /** symbol 缩写（展示用，缺省回退 code）。 */
  targetSymbol: string;
  targetBankCode: string;
  defaultSplitRatio: string | number;
  baseRate: string | number;
  markupRate: string | number;
  /** 引擎与存量值仍生效，但列表/表单均不展示不输入（01 文档 §G 裁决13）。 */
  slippageThreshold: string | number;
  status: number;
  createTime: number;
}

/** 与后端 TokenPairSaveReqVO 对齐；pairId 空=新建（pairCode 服务端生成）。 */
export interface TokenPairSaveReq {
  pairId?: number;
  sourceTokenId: number;
  targetTokenId: number;
  baseRate: string | number;
  markupRate?: string | number;
  defaultSplitRatio?: string | number;
  slippageThreshold?: string | number;
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
  20: 'Enabled',
  30: 'Frozen',
  50: 'Disabled',
};

/** Badge variant（conventions §5：启用=default、冻结=secondary、停用=outline）。 */
export const PAIR_STATUS_VARIANT: Record<
  number,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  20: 'default',
  30: 'secondary',
  50: 'outline',
};

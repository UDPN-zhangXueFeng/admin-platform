/**
 * 汇率查询聚合域模型（源 `types/business.ts` FxViewResp/FxPairItem/TokenPair/RateSnapshot）。
 *
 * GW-14 UDPN 对齐：GET /fx/view 一页融合 token 对 + LP + 最新汇率，替代原
 * tokenpair/lp/rate 三端点（旧域已随上游删除）。本域自持源语义类型。
 */

/** token 对推送缓存（gw_token_pair，GW-11 token 化）。status：20 启用 / 50 停用(冻结)。 */
export interface FxTokenPair {
  pairId: number;
  /** token 对编码（PR-+UUID，业务标识）。 */
  pairCode?: string;
  sourceTokenNo?: string;
  sourceTokenCode: string;
  sourceTokenName?: string;
  /** 源 token symbol（gw_token_pair.source_token_symbol；03716c8 由 sourceSymbol 重命名对齐后端字段名）。 */
  sourceTokenSymbol?: string;
  sourceBankCode?: string;
  targetTokenNo?: string;
  targetTokenCode: string;
  targetTokenName?: string;
  /** 目标 token symbol（gw_token_pair.target_token_symbol；03716c8 由 targetSymbol 重命名）。 */
  targetTokenSymbol?: string;
  targetBankCode?: string;
  userRate: number;
  status: number;
  version?: number;
  pushTime?: number;
}

/** 最新汇率快照（gw_rate_snapshot；fx 聚合视图返回每对最新一条快照，可为 null）。 */
export interface FxRateSnapshot {
  snapshotId?: number;
  pairId: number;
  baseRate: number;
  markupRate: number;
  userRate: number;
  version?: number;
  pushTime?: number;
}

/** 单个 token 对聚合项（rate 未推送过时为 null）。 */
export interface FxPairItem {
  tokenPair: FxTokenPair;
  /** 该 token 对启用 LP 名称列表。 */
  lpNames: string[];
  /** 最新汇率快照（按 version 倒序取 1）。 */
  rate: FxRateSnapshot | null;
}

/** LP 明细（gw_lp_info 全字段，含停用；源 types/business.ts LpInfo）。 */
export interface FxLpInfo {
  id: number;
  lpId: number;
  /** LP 编码（Kissen 侧 lp_code）。 */
  lpCode?: string;
  lpName: string;
  pairId: number;
  /** token 对编码（PR-xxx）。 */
  pairCode?: string;
  /** LP 源 token 资金池地址。 */
  sourcePoolAddress?: string;
  /** LP 目标 token 资金池地址。 */
  targetPoolAddress?: string;
  /** 20 启用 / 50 停用。 */
  status: number;
  version?: number;
  pushTime?: number;
}

/** token 对详情（GET /fx/detail/{pairId}；无匹配返回 null）。 */
export interface FxPairDetail {
  tokenPair: FxTokenPair;
  /** LP 明细（含停用，按 lpId 升序）。 */
  lps: FxLpInfo[];
  /** 最新汇率快照（无快照为 null）。 */
  latestRate: FxRateSnapshot | null;
  /** 最近快照历史（version 倒序 ≤10 条，首条与 latestRate 相同）。 */
  recentRates: FxRateSnapshot[];
}

/** 汇率查询聚合响应（GET /fx/view，GW-14 UDPN 对齐）。 */
export interface FxViewResp {
  pairs: FxPairItem[];
}

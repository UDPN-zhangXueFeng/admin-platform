/**
 * Journal Entries New 领域模型。
 *
 * 字段名 1:1 镜像源项目 `td-manage` 的 `JournalListItem` / `JournalDetailData`，
 * 仅额外补一个 `id: string`（shared DataTable 的 `{ id: string }` 契约，由 `tdTxId` 转换）。
 * 时间戳为 epoch 毫秒。
 */

// ── 列表 ───────────────────────────────────────────────────────────────

/** Journal 列表行（已注入字符串 `id`，供 DataTable 使用）。 */
export interface JournalEntry {
  /** DataTable 契约要求；由 `tdTxId` 转换而来。 */
  id: string;
  tdTxId: number;
  txHash?: string;
  fromAddress?: string;
  toAddress?: string;
  tokenName?: string;
  tokenType?: number;
  blockchain?: string;
  txType?: number;
  transactionAmount?: string | number;
  /** epoch 毫秒 */
  transactionTime?: number;
  currencyCode?: string;
}

/** 列表筛选条件（对应后端请求体的 `data` 字段）。 */
export interface JournalListFilters {
  fromAddress?: string;
  toAddress?: string;
  tokenName?: string;
  tokenType?: number;
  txType?: number;
  txHash?: string;
  /** epoch 毫秒，当日 00:00:00 */
  startTime?: number;
  /** epoch 毫秒，当日 23:59:59.999 */
  endTime?: number;
  blockchainId?: number;
}

/** 列表请求参数（分页 + 筛选）。 */
export interface JournalListParams {
  pageNum: number;
  pageSize: number;
  filters: JournalListFilters;
}

/** 列表响应（`apiClient` 已 unwrap 信封后的形状）。 */
export interface JournalListResponse {
  page?: {
    total?: number;
    pageNum?: number;
    pageSize?: number;
  };
  rows?: JournalEntry[];
}

// ── 详情 ───────────────────────────────────────────────────────────────

/** Raw Data 区块原始字段（源项目 `JournalRawData`）。 */
export interface JournalRawData {
  tdTxId?: number;
  fromAddress?: string;
  toAddress?: string;
  txHash?: string;
  tdCount?: string | number;
  txType?: number;
  txTime?: number;
  blockHeight?: string | number;
  blockHash?: string;
  contractAddress?: string;
  /** 区块原始数据（JSON 字符串或对象），Raw Data 左侧展示。 */
  blockData?: string;
  blockDate?: number;
}

/** Normalization Engine / Posting Entry 行（源项目 `JournalNormalizationRow`）。 */
export interface JournalNormalizationRow {
  sourceField?: string;
  mappingField?: string;
  fieldValue?: string;
  /** 1=DIRECT, 2=CONSTANT, 3=GENERATE */
  mappingMethod?: number;
}

/** T-Account 科目行（源项目 `JournalTAccount`）。 */
export interface JournalTAccount {
  accountCode?: string;
  accountName?: string;
  debitAmount?: string | number;
  creditAmount?: string | number;
}

/** 详情响应（源项目 `JournalDetailData`，兼容 `tAccounts` / `taccounts` 两种命名）。 */
export interface JournalDetailData {
  bookNo?: string;
  tranId?: string;
  rawData?: JournalRawData;
  normalizedJson?: Record<string, unknown>;
  normalizationData?: JournalNormalizationRow[];
  tAccounts?: JournalTAccount[];
  taccounts?: JournalTAccount[];
}

// ── 公共下拉 ──────────────────────────────────────────────────────────

/** `GET /common/stablecoin/enabled/searches` 返回项。 */
export interface StablecoinSearchOption {
  stablecoinId?: number;
  name?: string;
  mintMethod?: number;
}

/** `GET /common/blockchain/list` 返回项。 */
export interface BlockchainOption {
  key?: number;
  value?: string;
  status?: number;
}

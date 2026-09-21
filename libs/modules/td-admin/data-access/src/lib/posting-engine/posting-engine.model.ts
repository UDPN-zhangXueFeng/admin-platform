/**
 * Posting Engine 数据模型。
 *
 * 类型来源：td-manage `src/typings/token-finance/V1.ts` + `data-contracts.ts`。
 * 覆盖全部 7 个 endpoint 的请求 / 响应类型。
 */

/** 服务端分页信息（请求体）。 */
export interface PageInfo {
  pageNum: number;
  pageSize: number;
}

/** 服务端分页信息（响应体）。 */
export interface ResultPageInfo {
  pageNum?: number;
  pageSize?: number;
  total?: number;
  pages?: number;
}

/** 账本与 token 关联。 */
export interface BookTokenRel {
  tokenId?: number;
  tokenName?: string;
  tokenSymbol?: string;
}

// ── 账本（books / book-detail）─────────────────────────────────────────────

/**
 * 过账账本行（列表 + 账本详情共用）。
 *
 * 后端原始对象无 `id` 字段，API 层注入 `id = String(financeBookId)` 以满足
 * DataTable `{ id: string }` 契约（与 journal-entries-new 注入 tdTxId 同思路）。
 */
export interface PostingBook {
  id: string;
  financeBookId?: number;
  bookName?: string;
  bookNo?: string;
  currencyCode?: string;
  tokenType?: number;
  tokens?: BookTokenRel[];
  totalEvents?: number;
  configured?: number;
  lastRuleUpdate?: string;
  status?: number;
  reserveAssetName?: string;
  createdBy?: string;
  createTime?: number;
}

/** 列表筛选条件（对应 books API 的 data 字段）。 */
export interface PostingBookListFilters {
  financialBookName?: string;
  currencyCode?: string;
  tokenType?: number;
  startDate?: number;
  endDate?: number;
  status?: number;
}

/** 列表请求参数。 */
export interface PostingBookListParams {
  pageNum: number;
  pageSize: number;
  filters: PostingBookListFilters;
}

/** 列表响应。 */
export interface PostingBookListResponse {
  page?: ResultPageInfo;
  rows: PostingBook[];
}

// ── 事件（list / detail / update）──────────────────────────────────────────

/** 账户映射行（PostingEventAccountMappingRespVo）。 */
export interface PostingEventMapping {
  accountCode?: string;
  accountName?: string;
  /** 1=Debit，2=Credit。 */
  direction?: number;
  /** 1=DIRECT，2=CONSTANT。 */
  mappingMethod?: number;
  amountExpression?: string;
  sortOrder?: number;
}

/** 归一化目标字段（NormalizedTargetFieldVo，事件详情的事务事件字段）。 */
export interface PostingNormalizedField {
  targetField?: string;
  sourceField?: string;
}

/**
 * 过账事件（PostingEventRespVo，事件列表 + 事件详情 + 更新响应共用）。
 *
 * `id` 由 API 层注入（= `String(postingEventId)`）以满足列表 DataTable 契约。
 */
export interface PostingEvent {
  id: string;
  postingEventId?: number;
  financeBookId?: number;
  eventCode?: string;
  versionId?: string;
  eventType?: number;
  effectiveDate?: number;
  status?: number;
  remarks?: string;
  createTime?: number;
  updateTime?: number;
  /** 原始借贷方向串（换行 / 分号分隔，前端用 splitEntryDirection 解析）。 */
  entryDirection?: string;
  mappings?: PostingEventMapping[];
  normalizedTargetFields?: PostingNormalizedField[];
  currencyCode?: string;
  tokenType?: number;
  tokens?: BookTokenRel[];
  createdBy?: string;
  createdOn?: number;
  lastRuleUpdate?: string;
  bookName?: string;
  bookNo?: string;
  reserveAssetName?: string;
  /** 事件类型名（后端可能直出，用于标签展示）。 */
  eventTypeName?: string;
}

/** 事件列表请求参数（按账本筛选）。 */
export interface PostingEventListParams {
  pageNum: number;
  pageSize: number;
  financeBookId?: number;
}

/** 事件列表响应。 */
export interface PostingEventListResponse {
  page?: ResultPageInfo;
  rows: PostingEvent[];
}

/** 保存事件时的账户映射（PostingEventAccountMappingCreateReqVo）。 */
export interface SavePostingEventMapping {
  postingEventId: number;
  accountCode: string;
  accountName: string;
  direction?: number;
  mappingMethod: number;
  amountExpression?: string;
  sortOrder?: number;
}

/** 更新记账事件请求体（PostingEventUpdateReqVo）。 */
export interface SavePostingEventDTO {
  postingEventId: number;
  eventCode?: string;
  eventType?: number;
  versionId?: string;
  effectiveDate?: number;
  remarks?: string;
  mappings: SavePostingEventMapping[];
}

// ── Dr/Cr 科目选项（event-accounts）─────────────────────────────────────────

/** 记账事件科目选项（PostingEventAccountRespVo）。 */
export interface PostingAccountOption {
  accountCode?: string;
  accountName?: string;
  parentCode?: string;
  level?: number;
  /** 1=Asset，2=Liability，3=Equity，4=Income，5=Expense。 */
  type?: number;
  /** 1=Debit，2=Credit。 */
  direction?: number;
  allowPosting?: number;
  suspenseAccount?: number;
  status?: number;
  remarks?: string;
}

// ── 版本历史（history/list）─────────────────────────────────────────────────

/** 版本历史行（PostingHistoryRespVo）。 */
export interface PostingHistoryItem {
  id: string;
  recordId?: number;
  postingEventId?: number;
  sourceEventType?: string;
  versionId?: string;
  entryDirection?: string;
  effectiveDate?: number;
  createdBy?: string;
  createdOn?: number;
  status?: number;
  /** 审批任务 ID（有值时行操作跳转审批详情）。 */
  taskId?: number;
  busCode?: string;
}

/** 版本历史筛选条件。 */
export interface PostingHistoryListFilters {
  /** 必填。 */
  postingEventId: number;
  status?: number;
  eventType?: string;
  versionId?: string;
  createTimeStart?: number;
  createTimeEnd?: number;
  effectiveDateStart?: number;
  effectiveDateEnd?: number;
}

/** 版本历史请求参数。 */
export interface PostingHistoryListParams {
  pageNum: number;
  pageSize: number;
  filters: PostingHistoryListFilters;
}

/** 版本历史响应。 */
export interface PostingHistoryListResponse {
  page?: ResultPageInfo;
  rows: PostingHistoryItem[];
}

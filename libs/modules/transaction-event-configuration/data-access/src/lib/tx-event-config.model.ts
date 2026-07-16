/**
 * Transaction Event Configuration 数据模型。
 *
 * 类型来源：td-manage `src/typings/token-finance/data-contracts.ts`（Normalization* 系列）。
 * 覆盖全部 7 个 endpoint 的请求 / 响应类型。列表 / 详情响应在 API 层注入字符串 `id`
 * 以满足 DataTable `{ id: string }` 契约（与 posting-engine / journal-entries-new 同思路）。
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

/** 账本与 token 关联（BookTokenRelRespVo）。 */
export interface BookTokenRel {
  tokenId?: number;
  tokenName?: string;
  tokenSymbol?: string;
}

// ── Normalization Book（books）───────────────────────────────────────────────

/**
 * 标准化账本行（NormalizationBookListRespVo，列表用）。
 * `id` 由 API 层注入（= `String(financeBookId)`）。
 */
export interface NormalizationBook {
  id: string;
  financeBookId?: number;
  bookName?: string;
  tokenType?: number;
  reserveAssetName?: string;
  assetValue?: string;
  tokens?: BookTokenRel[];
  createdOn?: number;
  status?: number;
  /** 后端可能直出状态名（active / inactive），列表 active 判定兜底用。 */
  statusName?: string;
  currencyCode?: string;
}

/** 列表筛选条件（对应 books API 的 data 字段）。 */
export interface NormalizationBookListFilters {
  financialBookName?: string;
  tokenType?: number;
  currencyCode?: string;
  startDate?: number;
  endDate?: number;
  status?: number;
}

/** 列表请求参数。 */
export interface NormalizationBookListParams {
  pageNum: number;
  pageSize: number;
  filters: NormalizationBookListFilters;
}

/** 列表响应。 */
export interface NormalizationBookListResponse {
  page?: ResultPageInfo;
  rows: NormalizationBook[];
}

// ── Mapping Rule（mapping-rules 列表 + detail + update）──────────────────────

/** 映射明细（NormalizationEventMappingRespVo）。 */
export interface NormalizationEventMapping {
  normalizationEventMappingId?: number;
  normalizationEventId?: number;
  sourceField?: string;
  mappingField?: string;
  mappingCode?: string;
  /** 1=DIRECT，2=CONSTANT，3=GENERATE。 */
  mappingMethod?: number;
  /** 映射方法为 CONSTANT 时的常量值。 */
  fieldValue?: string;
  /** 1=系统内置，2=自定义。 */
  systemBuiltin?: number;
  orderNum?: number;
  remarks?: string;
  /** 源字段描述（取自 fin_table_field_info）。 */
  fieldDesc?: string;
  createTime?: number;
}

/**
 * 标准化事件（NormalizationEventRespVo，列表行 + 详情 + 更新响应共用）。
 * `id` 由 API 层注入（= `String(normalizationEventId)`）。
 */
export interface NormalizationEvent {
  id: string;
  normalizationEventId?: number;
  financeBookId?: number;
  eventCode?: string;
  versionId?: string;
  eventType?: number;
  effectiveDate?: number;
  status?: number;
  createTime?: number;
  updateTime?: number;
  createUser?: string;
  taskId?: number;
  busCode?: string;
  mappings?: NormalizationEventMapping[];
}

/** Mapping Rule 列表请求参数（按 financeBookId 过滤）。 */
export interface NormalizationEventListParams {
  pageNum: number;
  pageSize: number;
  financeBookId: number | string;
}

/** Mapping Rule 列表响应。 */
export interface NormalizationEventListResponse {
  page?: ResultPageInfo;
  rows: NormalizationEvent[];
}

/** 保存时的映射明细（NormalizationEventMappingCreateReqVo）。 */
export interface SaveNormalizationMapping {
  normalizationEventId: number;
  /**
   * 源字段。源项目仅 DIRECT 方法提交（buildSubmitMappings 用扩展运算符条件加），
   * 故放宽为 optional 以匹配实际 payload（CONSTANT/GENERATE 不传）。
   */
  sourceField?: string;
  mappingField: string;
  mappingCode?: string;
  /** 1=DIRECT，2=CONSTANT，3=GENERATE。 */
  mappingMethod: number;
  /** 映射方法为 CONSTANT 时必填。 */
  fieldValue?: string;
  /** 1=系统内置，2=自定义。 */
  systemBuiltin?: number;
  orderNum?: number;
  remarks?: string;
}

/** 更新标准化事件请求体（NormalizationEventUpdateReqVo）。 */
export interface SaveNormalizationEventDTO {
  normalizationEventId: number;
  eventCode?: string;
  eventType?: number;
  effectiveDate?: number;
  mappings: SaveNormalizationMapping[];
}

// ── 预览（preview）────────────────────────────────────────────────────────────

/** 预览映射结果明细（PreviewMappingResult）。 */
export interface NormalizationPreviewMapping {
  sourceField?: string;
  targetField?: string;
  /** DIRECT / CONSTANT / GENERATE。 */
  mappingType?: string;
  description?: string;
}

/** 预览响应（NormalizationPreviewRespVo）。 */
export interface NormalizationPreview {
  normalizationEventId?: number;
  eventCode?: string;
  eventType?: number;
  mappings?: NormalizationPreviewMapping[];
}

/** 预览请求（NormalizationPreviewReqVo）。 */
export interface NormalizationPreviewReq {
  normalizationEventId: number;
  /** 输入数据（模拟链上原始数据）。 */
  inputData?: Record<string, unknown>;
}

// ── 源字段（source-fields）────────────────────────────────────────────────────

/** 源字段信息（TableFieldInfoRespVo，编辑页源字段下拉用）。 */
export interface TableFieldInfo {
  fieldInfoId?: number;
  eventTypeId?: number;
  fieldName?: string;
  fieldDesc?: string;
}

/** 源字段查询参数（按 eventType + normalizationEventId）。 */
export interface SourceFieldsParams {
  eventType: number;
  normalizationEventId: number | string;
}

// ── 历史记录（history/list）──────────────────────────────────────────────────

/**
 * 历史记录行（NormalizationHistoryRespVo，Historical Records tab 用）。
 * `id` 由 API 层注入（= `String(recordId)`）。
 */
export interface NormalizationHistoryItem {
  id: string;
  recordId?: number;
  normalizationEventId?: number;
  eventType?: string;
  status?: number;
  effectiveDate?: number;
  createdBy?: string;
  createdOn?: number;
  taskId?: number;
  busCode?: string;
  mappingRuleId?: string;
}

/** 历史记录筛选条件。 */
export interface NormalizationHistoryListFilters {
  /** 必填。 */
  normalizationEventId: number;
  status?: number;
  eventType?: string;
  createTimeStart?: number;
  createTimeEnd?: number;
  effectiveDateStart?: number;
  effectiveDateEnd?: number;
  mappingRuleId?: string;
}

/** 历史记录请求参数。 */
export interface NormalizationHistoryListParams {
  pageNum: number;
  pageSize: number;
  filters: NormalizationHistoryListFilters;
}

/** 历史记录响应。 */
export interface NormalizationHistoryListResponse {
  page?: ResultPageInfo;
  rows: NormalizationHistoryItem[];
}

/**
 * Audit Trail 数据模型。
 *
 * 类型来源：td-manage financial/audit-trail/index.tsx（列表）+ view.tsx（详情）。
 * 列表行注入字符串 `id`（= String(traceId)）以满足 DataTable `{ id: string }` 契约。
 */

/** 服务端分页信息（响应体）。 */
export interface ResultPageInfo {
  total?: number;
  pageNum?: number;
  pageSize?: number;
  pages?: number;
}

/** Audit Trail 列表行（listPage rows）。 */
export interface AuditTrailItem {
  id: string;
  traceId: string;
  txFrom?: string;
  txTo?: string;
  txType?: number;
  tokenName?: string;
  tokenType?: number;
  blockchainName?: string;
  txAmount?: number | string;
  symbol?: string;
  txTime?: number;
  txHash?: string;
}

/** 列表筛选条件（对应 listPage data 字段）。 */
export interface AuditTrailListFilters {
  traceId?: string;
  txFrom?: string;
  txTo?: string;
  txType?: number | string;
  tokenName?: string;
  tokenType?: number | string;
  blockchainId?: number | string;
  txStartTime?: number;
  txEndTime?: number;
  txHash?: string;
}

/** 列表请求参数。 */
export interface AuditTrailListParams {
  pageNum: number;
  pageSize: number;
  filters: AuditTrailListFilters;
}

/** 列表响应。 */
export interface AuditTrailListResponse {
  page?: ResultPageInfo;
  rows: AuditTrailItem[];
}

/** Audit 日志明细行（detail.logList，Timeline 展示）。 */
export interface AuditLogItem {
  logId?: number;
  serviceName?: string;
  requestor?: string;
  requestHost?: string;
  requestMethod?: string;
  requestAddress?: string;
  requestUrl?: string;
  requestTime?: number;
  processingTime?: number;
  processingStatus?: number;
  requestData?: string;
  responseTime?: number;
  responseData?: string;
}

/** Audit Trail 详情（detail）。 */
export interface AuditTrailDetail {
  traceId?: string;
  txType?: number;
  symbol?: string;
  txAmount?: number | string;
  txFrom?: string;
  txTo?: string;
  tokenName?: string;
  tokenType?: number;
  blockchainName?: string;
  createTime?: number;
  txHash?: string;
  txTime?: number;
  logList?: AuditLogItem[];
}

/** 导出任务请求体（exportTaskcreateApi，auditTrailDownloadReqVO）。 */
export interface ExportAuditTaskReq {
  exportType: number;
  moduleType: number;
  auditTrailDownloadReqVO:
    | { traceId: number | string }
    | AuditTrailListFilters;
}

/** Stablecoin 下拉项（stablecoin/enabled/searches）。 */
export interface StablecoinSearchOption {
  stablecoinId?: number;
  name?: string;
  /** 1=TD（txType 1-6），其他=stablecoin（txType 3,4,6）。 */
  issueType?: number;
}

/** 区块链下拉项（blockchain/list）。 */
export interface BlockchainOption {
  key?: number | string;
  value?: string;
  status?: number;
}

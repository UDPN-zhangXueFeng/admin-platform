/**
 * Statements 数据模型。
 *
 * 类型来源：td-manage financial/statements（index/export/view）。
 * 列表行注入字符串 `id`（= String(主键)）满足 DataTable `{ id: string }` 契约。
 */

export interface ResultPageInfo {
  total?: number;
  pageNum?: number;
  pageSize?: number;
  pages?: number;
}

// ── 导出规则（list/rule）──
export interface ExportRule {
  id: string;
  exportRuleId?: number;
  taskName?: string;
  tokenName?: string;
  tokenType?: number;
  blockchainName?: string;
  exportStrategy?: number;
  createTime?: number;
  lastExecutedTime?: number;
  /** 20 启用 / 30 禁用。 */
  status?: number;
}
export interface ExportRuleListFilters {
  tokenId?: number | string;
  blockchainId?: number | string;
  exportStrategy?: number | string;
  createStartTime?: number;
  createEndTime?: number;
  lastExecutedStartTime?: number;
  lastExecutedEndTime?: number;
  status?: number | string;
}
export interface ExportRuleListParams {
  pageNum: number;
  pageSize: number;
  filters: ExportRuleListFilters;
}
export interface ExportRuleListResponse {
  page?: ResultPageInfo;
  rows: ExportRule[];
}

// ── 导出任务（list/my + list/all）──
export interface ExportTask {
  id: string;
  exportTaskId?: number;
  tokenName?: string;
  blockchainName?: string;
  transactionTypes?: number[];
  walletAddress?: string;
  fileId?: string;
  fileHash?: string;
  startTime?: number;
  endTime?: number;
  exportTime?: number;
  /** 0-3。 */
  exportState?: number;
  proofHash?: string;
  proofTime?: number;
  /** 2-6（仅 exportState=2 显示）。 */
  proofState?: number;
  busId?: string;
  busType?: string;
}
export interface ExportTaskListFilters {
  tokenId?: number | string;
  blockchainId?: number | string;
  fileId?: string;
  txStartTime?: number;
  txEndTime?: number;
  createStartTime?: number;
  createEndTime?: number;
  exportState?: number | string;
  /** list/all 用（按规则筛选）。 */
  exportRuleId?: number;
  moduleType?: number;
}
export interface ExportTaskListParams {
  pageNum: number;
  pageSize: number;
  filters: ExportTaskListFilters;
}
export interface ExportTaskListResponse {
  page?: ResultPageInfo;
  rows: ExportTask[];
}

// ── 规则详情（rule/detail）──
export interface ExportRuleDetail {
  status?: number;
  taskName?: string;
  tokenName?: string;
  transactionTypes?: number[];
  exportStrategy?: number;
  fileType?: number;
  createUserName?: string;
  createTime?: number;
  blockchainName?: string;
  notifyEmail?: string;
}

// ── DTO ──
export interface CreateExportRuleDTO {
  exportStrategy: number;
  taskName: string;
  tokenId: number | string;
  txTypes: number[];
  notifyEmail?: string;
}
export interface OperateExportRuleDTO {
  exportRuleId: number | string;
  /** 20 启用 / 30 禁用 / 35 删除。 */
  state: number;
}
export interface CreateExportTaskDTO {
  exportType: number;
  moduleType: number;
  notifyEmail?: string;
  transactionRecordsListReqVO: {
    tokenId?: number | string;
    txStartTime?: number | string;
    txEndTime?: number | string;
    txTypes?: number[];
    walletAddress?: string;
  };
}
export interface DeleteExportTaskDTO {
  exportTaskId: number | string;
}

// ── 公共下拉 ──
export interface StablecoinSearchOption {
  stablecoinId?: number;
  name?: string;
  issueType?: number;
  blockchainNameAbbreviation?: string;
}
export interface BlockchainOption {
  key?: number | string;
  value?: string;
  status?: number;
}

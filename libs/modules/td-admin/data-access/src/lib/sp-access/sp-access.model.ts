/**
 * SP Access Management 数据模型。
 *
 * 字段名与上游 td-manage `sp-access` 接口契约保持一致（含 `creatEndTime`
 * 这类上游拼写），feature 层只做展示格式化，不再做字段重命名映射。
 * 后端数值字段实际可能以 string 下发，展示层必须 `Number()` 前置转换。
 */

export interface SpAccessPageInfo {
  total?: number;
  pageNum?: number;
  pageSize?: number;
}

// ---------- 列表 ----------

export interface SpAccessListItemTdInfo {
  tdName?: string;
  blockchainNameAbbreviation?: string;
  tokenType?: number;
  stablecoinCode?: string;
}

export interface SpAccessListItem {
  spId?: number;
  spRecordId?: number;
  spCode?: string;
  spName?: string;
  contactName?: string;
  email?: string;
  td?: string;
  tdInfo?: SpAccessListItemTdInfo[];
  state?: number;
  createTime?: number;
  spType?: number;
}

export interface SpAccessListResponse {
  rows: SpAccessListItem[];
  total: number;
  pageNum: number;
  pageSize: number;
}

export interface SpAccessListFilters {
  spName?: string;
  /** '' 表示未筛选，契约要求恒发送 */
  spType?: string | number;
  contactName?: string;
  email?: string;
  tdName?: string;
  createStartTime?: number;
  createEndTime?: number;
  /** '' 表示全部，契约要求恒发送 */
  state?: string | number;
}

export interface SpAccessListParams {
  pageNum: number;
  pageSize: number;
  filters?: SpAccessListFilters;
}

// ---------- 详情 ----------

export interface SpAccessPermissionWalletType {
  walletRuleId?: number;
  state?: number;
  /** 审批/详情展示用（上游 walletTypeList[].name） */
  name?: string;
}

export interface SpAccessPermissionEntry {
  accessConfId?: number;
  /** 审批/详情展示用（上游 typeAndPermissionList[].accessConfName） */
  accessConfName?: string;
  walletTypeList?: SpAccessPermissionWalletType[];
}

export interface SpAccessDetailAccessItem {
  accessType?: number;
  transactionToggle?: number;
  permissionsList?: Array<{
    accessConfId?: number;
    walletTypeIdList?: number[];
  }>;
  typeAndPermissionList?: SpAccessPermissionEntry[];
}

export interface SpAccessDetailTd {
  tdId?: number;
  /** 上游按 tokenCode>stablecoinCode>tdCode>tokenName>tdName 取首个非空 */
  tokenCode?: string;
  stablecoinCode?: string;
  tdCode?: string;
  tokenName?: string;
  tdName?: string;
  blockchainName?: string;
  walletAddress?: string;
  contractAddress?: string;
  webhookUrl?: string;
  state?: number;
  tokenType?: number;
  kycRequired?: number;
  accessList?: SpAccessDetailAccessItem[];
}

export interface SpAccessDetail {
  spId: number;
  spRecordId?: number;
  spCode: string;
  spName?: string;
  spType?: number;
  contactName?: string;
  email?: string;
  phone?: string;
  spDesc?: string;
  /** 展示状态（上游 spInfoState，缺省回退 state） */
  state?: number;
  fileId?: number;
  fileName?: string;
  fileType?: string;
  fileUrl?: string;
  busType?: number;
  metaType?: number;
  reconciliationFrequency?: number;
  privateKeyCustodyModel?: string;
  transactionPolicy?: string;
  /** 编辑态代币配置回填（上游 detailInfo.tdList，按 tdId===stablecoinId 匹配） */
  tdList?: SpAccessDetailTd[];
  /** 上游 createUser（BaseInfo Created by 行） */
  createUser?: string;
  createTime?: number;
}

// ---------- 钱包规则 / 权限配置 ----------

export interface SpAccessWalletRuleOption {
  /** 上游实际返回 ruleId（部分样本无 walletRuleId），归一化后统一暴露 */
  walletRuleId: number;
  name?: string;
  /** 上游不保证下发；缺失不视为禁用（state!==0 过滤对 undefined 恒真） */
  state?: number;
}

export interface SpAccessWalletRule {
  stablecoinId: number;
  name?: string;
  symbol?: string;
  blockchainName?: string;
  tokenType?: number;
  walletRules: SpAccessWalletRuleOption[];
}

export interface SpAccessTypeOption {
  accessConfId: number;
  name?: string;
  contractFuncName?: string;
  apiFuncName?: string;
  apiFuncUrl?: string;
}

export interface SpAccessStablecoinOption {
  name?: string;
}

// ---------- 用户钱包 ----------

export interface SpAccessUserWallet {
  walletId?: number;
  walletAddress?: string;
  walletType?: string;
  privateKeyCustodyModel?: number;
  tdName?: string;
  tokenType?: number;
  /** 后端可能下发 string，展示层 Number() 防御 */
  stablecoinCount?: number | string;
  kycRequired?: number;
  state?: number;
  createTime?: number;
}

export interface SpAccessUserWalletListResponse {
  rows: SpAccessUserWallet[];
  total: number;
  pageNum: number;
  pageSize: number;
}

export interface SpAccessUserWalletListParams {
  pageNum: number;
  pageSize: number;
  spCode?: string;
  walletAddress?: string;
  custodyModel?: number | string;
  tokenName?: string;
  tokenType?: number | string;
  createStartTime?: number;
  /** 上游契约拼写即为 creatEndTime */
  creatEndTime?: number;
  kycRequired?: number | string;
  status?: number | string;
}

// ---------- 提交的交易 ----------

export interface SpAccessSubmittedTransaction {
  tokenName?: string;
  tokenType?: number;
  txType?: number;
  /** 后端可能下发 string，展示层 Number() 防御 */
  amount?: number | string;
  dataSource?: number;
  txHash?: string;
  status?: number;
  txTime?: number;
  createTime?: number;
}

export interface SpAccessSubmittedTransactionListResponse {
  rows: SpAccessSubmittedTransaction[];
  total: number;
  pageNum: number;
  pageSize: number;
}

export interface SpAccessSubmittedTransactionListParams {
  pageNum: number;
  pageSize: number;
  spCode?: string;
  tokenCode?: string;
  txType?: number | string;
  dataSource?: number | string;
  status?: number | string;
  txHash?: string;
  txStartTime?: number;
  txEndTime?: number;
}

// ---------- 操作记录 ----------

export interface SpAccessOperationRecord {
  spRecordId?: number;
  type?: number;
  state?: number;
  createUserName?: string;
  createTime?: number;
  businessCode?: string;
  taskId?: number;
}

export interface SpAccessOperationRecordListResponse {
  rows: SpAccessOperationRecord[];
  total: number;
  pageNum: number;
  pageSize: number;
}

export interface SpAccessOperationRecordListParams {
  pageNum: number;
  pageSize: number;
  spCode?: string;
  operationType?: number | string;
}

// ---------- 保存 / 编辑 ----------

export interface SpAccessSavePermission {
  accessConfId: number;
  walletTypeIdList: number[];
}

export interface SpAccessSaveAccessPayload {
  accessType: number;
  transactionToggle: number;
  permissionsList: SpAccessSavePermission[];
}

export interface SpAccessSaveTdPayload {
  tdId: number;
  walletAddress: string;
  contractAddress: string;
  accessList: SpAccessSaveAccessPayload[];
  kycRequired: number;
  webhookUrl: string;
}

export interface SpAccessSavePayload {
  /** 新建必填；编辑恒发送（detailInfo.spName 优先） */
  spName?: string;
  /** 仅编辑发送 */
  spCode?: string;
  contactName: string;
  email: string;
  /** 契约恒发送（可为 ''） */
  phone?: string;
  /** 契约恒发送（可为 ''） */
  description?: string;
  fileId?: number;
  tdAccessList: SpAccessSaveTdPayload[];
  spType: number;
  metaType: number;
  reconciliationFrequency: number;
  privateKeyCustodyModel: string;
  transactionPolicy: string;
}

// ---------- 审批 ----------

export interface SpAccessAuditPayload {
  spRecordId: number;
  /** true=通过(3) / false=驳回(2) */
  auditFlag: boolean;
  auditRemark: string;
}

// ---------- 文件 ----------

export interface SpAccessUploadLicensePayload {
  file: File;
  /** 上游固定 '1' */
  busType: string;
}

export interface SpAccessUploadLicenseResult {
  fileId: number;
}

export interface SpAccessSftpBase64Params {
  busType?: number | string;
  busId?: number | string;
}

export interface SpAccessDownloadLicenseParams {
  busId?: number | string;
  busType?: number | string;
}

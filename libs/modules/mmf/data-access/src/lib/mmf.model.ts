/**
 * mmf（Money Market Fund / Dividend，分红计提与结算）数据模型。
 *
 * 类型来源：td-manage mmf（accrual/index / accrual/view / settlement/index / settlement/view）。
 * 列表行注入字符串 `id`（= String(主键)）满足 DataTable `{ id: string }` 契约。
 * 金额字段统一包含 `tokenSymbol`，前端渲染格式 `reSet(value) + ' ' + tokenSymbol`。
 */

export interface ResultPageInfo {
  total?: number;
  pageNum?: number;
  pageSize?: number;
  pages?: number;
}

// ── 基金下拉 ──
export interface FundOption {
  ruleId?: number;
  fundName?: string;
}

// ── 计提记录（列表行）──
export interface AccrualRecordItem {
  id: string;
  accrualRecordId?: number;
  /** 计提日期（时间戳）。 */
  accrualDate?: number;
  fundName?: string;
  tokenName?: string;
  blockchainName?: string;
  /** 计提单位数。 */
  accrualUnits?: number;
  /** 钱包总余额。 */
  totalWalletBalance?: number;
  /** 钱包总数。 */
  totalWallets?: number;
  /** 5/10/35，对应 ACCRUAL_STATUS_COLOR。 */
  status?: number;
  /** 金额拼接用 token 符号。 */
  tokenSymbol?: string;
  /** 账单编码（跳详情用）。 */
  billCode?: string;
  /** 规则 ID（单条申报用）。 */
  ruleId?: number;
  dividendMethod?: string;
}

export interface AccrualListFilters {
  accrualTimeStartDate?: number;
  accrualTimeEndDate?: number;
  ruleId?: number | string;
  tokenId?: number | string;
  blockchainId?: number | string;
  status?: number | string;
}

export interface AccrualListParams {
  pageNum: number;
  pageSize: number;
  filters: AccrualListFilters;
}

export interface AccrualListResponse {
  page?: ResultPageInfo;
  rows: AccrualRecordItem[];
}

// ── 计提详情（13 字段）──
export interface AccrualDetail {
  /** 计提日期。 */
  accrualDate?: number;
  /** 币种名 + 链名（拼接显示 "tokenName (blockchainName)"）。 */
  tokenName?: string;
  blockchainName?: string;
  fundName?: string;
  fundCode?: string;
  /** 总单位数。 */
  totalUnits?: number;
  totalUnitsSymbol?: string;
  dividendMethod?: string;
  /** 钱包总余额。 */
  totalWalletBalance?: number;
  /** 钱包总数。 */
  totalWallets?: number;
  /** 创建人。 */
  createdBy?: string;
  /** 创建时间。 */
  createdOn?: number;
  /** 申报人。 */
  appliedBy?: string;
  /** 申报时间。 */
  appliedOn?: number;
  /** 5/10/35，span:3 打破网格。 */
  status?: number;
}

// ── 计提钱包明细（子表格）──
export interface AccrualWalletRecord {
  /** 由 API 层注入（= String(accrualTime)）满足子表格 DataTable `{ id: string }` 契约。源以 accrualTime 为 rowKey。 */
  id: string;
  /** 用作子表格 rowKey（源）。 */
  accrualTime?: number;
  walletAddress?: string;
  blockchainName?: string;
  walletBalance?: number;
  accrualUnits?: number;
  tokenSymbol?: string;
}

export interface AccrualWalletListFilters {
  walletAddress?: string;
  billCode?: string;
}

export interface AccrualWalletListParams {
  pageNum: number;
  pageSize: number;
  filters: AccrualWalletListFilters;
}

// ── 结算记录（列表行）──
export interface SettlementRecordItem {
  id: string;
  settlementId?: number;
  settlementCode?: string;
  /** 申请时间（时间戳）。 */
  createTime?: number;
  fundName?: string;
  tokenName?: string;
  blockchainName?: string;
  /** 交易类型（i18n: mmf_settlement_tx_type_${txType}）。 */
  transactionType?: number;
  /** 计提代币数。 */
  accruedTokenCount?: number;
  /** 实发代币数。 */
  realityTokenCount?: number;
  /** 5/10/15/20/35/40，对应 SETTLEMENT_STATUS_COLOR。 */
  status?: number;
  tokenSymbol?: string;
}

export interface SettlementListFilters {
  settlementCode?: string;
  appliedTimeStartDate?: number;
  appliedTimeEndDate?: number;
  ruleId?: number | string;
  status?: number | string;
}

export interface SettlementListParams {
  pageNum: number;
  pageSize: number;
  filters: SettlementListFilters;
}

export interface SettlementListResponse {
  page?: ResultPageInfo;
  rows: SettlementRecordItem[];
}

// ── 结算详情（不含 riskLevel / createUser 死代码）──
export interface SettlementDetail {
  settlementCode?: string;
  /** 申请时间。 */
  createTime?: number;
  tokenName?: string;
  blockchainName?: string;
  fundName?: string;
  dividendMethod?: string;
  /** 总单位数。 */
  totalUnits?: number;
  totalUnitsSymbol?: string;
  /** 最终分配数。 */
  finalDistributed?: number;
}

// ── 结算钱包记录（子表格 Tab1）──
export interface SettlementWalletRecord {
  /** 由 API 层注入（= String(accrualDate)）满足子表格 DataTable `{ id: string }` 契约。源以 accrualDate 为 rowKey。 */
  id: string;
  /** 计提日期（时间戳），源用作子表格 rowKey。 */
  accrualDate?: number;
  walletAddress?: string;
  blockchainName?: string;
  accrualUnits?: number;
  /** 最终分配数。 */
  finalDistributed?: number;
  txTime?: number;
  txHash?: string;
  /** 20/30/35/40，对应 SETTLEMENT_WALLET_RECORD_STATUS_COLOR。 */
  status?: number;
  tokenSymbol?: string;
}

export interface SettlementWalletListFilters {
  walletAddress?: string;
  settlementId?: number;
  status?: number | string;
}

export interface SettlementWalletListParams {
  pageNum: number;
  pageSize: number;
  filters: SettlementWalletListFilters;
}

// ── 结算审批记录（子表格 Tab2）──
export interface SettlementApprovalRecord {
  /** 由 API 层注入（= String(createTime)）满足子表格 DataTable `{ id: string }` 契约。源以 createTime 为 rowKey。 */
  id: string;
  /** 创建时间（时间戳），源用作子表格 rowKey。 */
  createTime?: number;
  /** 操作类型（i18n: mmf_settlement_operation_type_${opType}）。 */
  operationType?: number;
  createBy?: string;
  /** 审批状态码，取值见 mmf.json 的 approval_task_status_color_*（1/3/5/10/15/20/25/30/35/40/45）。色值走同名 i18n key。 */
  status?: number;
  /** 跳转 /approval-manage/view 用。 */
  taskId?: number;
  businessCode?: string;
}

export interface SettlementApprovalListFilters {
  settlementId?: number;
}

export interface SettlementApprovalListParams {
  pageNum: number;
  pageSize: number;
  filters: SettlementApprovalListFilters;
}

// ── 批量申报查询（Modal 内嵌静态表格）──
export interface BatchApplyListItem {
  accrualRecordId?: number;
  fundName?: string;
  accrualDate?: number;
  dividendMethod?: string;
  accrualUnits?: number;
  totalWalletBalance?: number;
  totalWallets?: number;
  tokenSymbol?: string;
}

export interface BatchApplyListParams {
  ruleId?: number;
  accrualTimeStartDate?: number;
  accrualTimeEndDate?: number;
}

// ── 申报写入（批量/单条）──
export interface ApplyReqVO {
  accrualRecordId?: number;
  accrualUnits?: number;
}

export interface AccrualApplyReqVO {
  /** 批量申报：勾选行映射的 applyReqVOList。 */
  applyReqVOList: ApplyReqVO[];
  ruleId?: number;
  totalAccrualUnits?: number;
}

/** 单条申报确认 Modal 展示用（currentData 预填）。 */
export interface SingleApplyPreviewItem {
  fundName?: string;
  accrualDate?: number;
  dividendMethod?: string;
  accrualUnits?: number;
  totalWalletBalance?: number;
  totalWallets?: number;
  tokenSymbol?: string;
  ruleId?: number;
  accrualRecordId?: number;
}

// ── 公共下拉（复用 statements 同款）──
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

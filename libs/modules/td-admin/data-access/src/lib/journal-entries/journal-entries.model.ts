/**
 * Journal Entries (旧版 Bill Rule) 数据模型。
 *
 * 类型来源：td-manage financial/journal-entries（index/edit/view）。
 * 列表行注入 id = String(ruleId) 满足 DataTable 契约。
 */

export interface ResultPageInfo {
  total?: number;
  pageNum?: number;
  pageSize?: number;
  pages?: number;
}

// ── 规则列表（bill/rule/listPage）──
export interface BillRule {
  id: string;
  ruleId?: number;
  ledgerName?: string;
  tokenName?: string;
  tokenType?: number;
  tokenSymbol?: string;
  blockchainName?: string;
  currencySymbol?: string;
  usPrice?: number | string;
  createTime?: number;
  /** 1 启用 / 0 禁用。 */
  state?: number;
}
export interface BillRuleListFilters {
  ledgerName?: string;
  stablecoinId?: number | string;
  tokenType?: number | string;
  currencySymbol?: number | string;
  blockchainId?: number | string;
  createStartTime?: number;
  createEndTime?: number;
  state?: number | string;
}
export interface BillRuleListParams {
  pageNum: number;
  pageSize: number;
  filters: BillRuleListFilters;
}
export interface BillRuleListResponse {
  page?: ResultPageInfo;
  rows: BillRule[];
}

// ── 规则详情（bill/rule/detail）──
/** 科目映射行（loanRuleList，Dr/Cr）。 */
export interface LoanRule {
  loanType?: number; // 1 借 / 2 贷
  subjectCategory?: string;
  subjectCode?: string;
  subjectTitle?: string;
  amountDesc?: string;
  txType?: number;
}
/** txType 区块（txBillRuleList，每 txType 一组 Dr/Cr）。 */
export interface TxTypeRule {
  txType: number;
  loanRuleList: LoanRule[];
}
export interface BillRuleDetail {
  ruleId?: number;
  ledgerName?: string;
  stablecoinId?: number;
  tokenType?: number;
  tokenSymbol?: string;
  tokenName?: string;
  blockchainNameAbbreviation?: string;
  usPrice?: number | string;
  currencySymbol?: string;
  txBillRuleList?: TxTypeRule[];
}

// ── token 下拉（bill/rule/add/tokenList）──
export interface BillTokenOption {
  stablecoinId?: number;
  tokenName?: string;
  tokenType?: number;
  tokenSymbol?: string;
  blockchainNameAbbreviation?: string;
  usPrice?: number | string;
  currencySymbol?: string;
}

// ── 科目下拉（bill/rule/add/subjectList）──
export interface BillSubject {
  subjectCode?: string;
  subjectTitle?: string;
  subjectCategory?: string;
}

// ── 利息交易类型（interest/tx/type）──
export interface InterestTxType {
  transactionType?: number;
  transactionName?: string;
}

// ── 账本交易列表（bill/otx/list，view 页）──
export interface BillTxItem {
  id: string;
  traceId?: string;
  dateTime?: number;
  txType?: number;
  blockchainName?: string;
  subjectCode?: string;
  subjectTitle?: string;
  particularsAccount?: string;
  stablecoinName?: string;
  txAmount?: number | string;
  /** 1 借 / 2 贷。 */
  loanType?: number;
  txHash?: string;
}
export interface BillTxListFilters {
  ruleId?: number;
  traceId?: string;
  txType?: number | string;
  startTime?: number | string;
  endTime?: number | string;
}
export interface BillTxListParams {
  pageNum: number;
  pageSize: number;
  filters: BillTxListFilters;
}
export interface BillTxListResponse {
  page?: ResultPageInfo;
  rows: BillTxItem[];
}

// ── DTO ──
export interface OperateBillRuleDTO {
  ruleId: number | string;
  /** 0 禁用 / 1 启用。 */
  state: number;
}
export interface SaveBillRuleDTO {
  ruleId?: number;
  ledgerName: string;
  stablecoinId: number | string;
  txBillRuleList: TxTypeRule[];
}
export interface SaveSubjectDTO {
  subjectTitle: string;
  subjectCode: string;
  subjectCategory?: string;
  stablecoinId: number | string;
}
export interface ExportBillTxReq {
  exportType: number;
  moduleType: number;
  billTxListReqVO: BillTxListFilters;
}

// ── 公共下拉 ──
export interface StablecoinSearchOption {
  stablecoinId?: number;
  name?: string;
  issueType?: number;
}
export interface BlockchainOption {
  key?: number | string;
  value?: string;
  status?: number;
}
export interface CurrencyOption {
  key?: string;
  value?: string;
}

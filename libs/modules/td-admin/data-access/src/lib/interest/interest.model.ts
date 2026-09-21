/**
 * Interest 模块类型定义（policy + accrual + transactions 三子域）。
 *
 * 迁移自 td-manage `src/pages/interest/*` + `src/lib/api/interest.ts`。
 * 列表行注入字符串 `id` 以满足 DataTable `{ id: string }` 契约。
 * 字段名遵循后端驼峰。
 */

// ── 分页/响应公共结构 ──────────────────────────────────────────────────────────

/** 列表行注入 id 后的基类契约（DataTable 要求）。 */
export interface InterestRow {
  id: string;
}

/** 服务端分页请求参数。 */
export interface InterestListParams<F> {
  pageNum: number;
  pageSize: number;
  filters: F;
}

/** 分页响应公共结构（后端 `{ page, rows }`）。 */
export interface InterestListPage {
  pageNum?: number;
  pageSize?: number;
  total?: number;
  pages?: number;
}

export interface InterestListResponse<R extends InterestRow> {
  page?: InterestListPage;
  rows: R[];
}

/** 单对象响应壳（apiClient 自动解包）。 */
export interface InterestInfo<T> {
  code: number;
  message?: string;
  data: T;
}

// ── 公共下拉类型 ───────────────────────────────────────────────────────────────

export interface StablecoinOption {
  stablecoinId: number | string;
  name: string;
}

export interface BlockchainOption {
  key: number | string;
  value: string;
  status: number; // 1 = enabled
}

// ── Policy（策略）域 ──────────────────────────────────────────────────────────

/** 计息策略列表行（rowKey=interestRuleId）。 */
export interface InterestRule extends InterestRow {
  interestRuleId: number;
  interestPolicyName: string;
  interestType: number; // 1=Overdraft, 2=Deposit
  accountType: number; // 1=Current account, 2=Savings account
  annualInterestRate: string;
  interestCalculationMethod: number; // 1=Whole Balance, 2=Partial Balance
  effectiveTime: string;
  createTime: string;
  status: number; // 1=Processing, 5=Unactivated, 10=Active, 15=Inactive
  updateTime?: string;
  updateUserName?: string;
}

/** 策略列表请求筛选。 */
export interface InterestRuleListFilters {
  interestType: number;
  interestPolicyName?: string;
  effectiveStartDate?: string;
  effectiveEndDate?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
}

/** 分段利率子项（saveDetails 数组元素）。 */
export interface SaveDetailItem {
  interestRate: string;
  maxValue: number;
  minValue: number;
}

/** 策略详情（detail API 返回）。 */
export interface InterestRuleDetail {
  interestRuleId: number;
  interestPolicyName: string;
  interestType: number;
  accountType: number;
  annualInterestRate: string;
  interestCalculationMethod: number;
  effectiveTime: string;
  createTime?: string;
  updateTime?: string;
  updateUserName?: string;
  status: number;
  calculateTimeDay: string; // HH:mm:ss
  calculateTimeMonth: string; // HH:mm:ss
  calculateDigitDay?: number;
  calculateDigitMonth?: number;
  calculateDayMonth?: number;
  saveDetails?: SaveDetailItem[];
}

/** 策略操作记录行。 */
export interface PolicyOperationRecord extends InterestRow {
  ruleRecordId: number;
  recordType: number; // 1=Add, 2=Edit, 3=Activate, 4=Deactivate
  createUserName: string;
  createTime: string;
  status: number;
  taskId?: string;
  busCode?: string;
}

/** 策略操作记录筛选。 */
export interface PolicyOperationListFilters {
  interestRuleId: number;
  recordType?: string;
}

// ── 策略写操作 ────────────────────────────────────────────────────────────────

/** 策略创建/编辑请求体。 */
export interface InterestRuleSaveParams {
  interestType: number;
  interestPolicyName: string;
  accountType: number;
  interestCalculationMethod: number;
  annualInterestRate: string | null;
  effectiveTime: number; // epoch timestamp
  calculateTimeDay: string; // HH:mm:ss
  calculateTimeMonth: string; // HH:mm:ss
  calculateDayMonth?: number;
  calculateDigitDay?: number;
  calculateDigitMonth?: number;
  saveDetails?: SaveDetailItem[];
  interestRuleId?: number; // 编辑时携带
}

/** 策略启停请求体。 */
export interface InterestOperateParams {
  interestRuleId: number;
  state: number; // 10=Enable, 15=Disable
}

// ── Accrual（计息记录）域 ─────────────────────────────────────────────────────

/** 计息记录列表行（rowKey=interestRuleId）。 */
export interface AccrualRecord extends InterestRow {
  interestRuleId: number;
  accrualRecordId: number;
  accrualTime: string;
  tokenId: number;
  tokenName: string;
  symbol: string;
  blockchainName: string;
  blockchainNameAbbreviation?: string;
  feeType: number; // 50=Deposit Interest, 60=Overdraft Interest
  feePeriod: string;
  accrualAmount: number;
  totalWallets: number;
}

/** 计息记录列表筛选。 */
export interface AccrualRecordListFilters {
  accrualTimeStartDate?: string;
  accrualTimeEndDate?: string;
  tokenId?: string;
  blockchainId?: string;
  feeType?: string;
}

/** 计息记录详情。 */
export interface AccrualRecordDetail {
  accrualRecordId: number;
  accrualTime: string;
  accrualAmount: number;
  feeType: number;
  tokenName: string;
  totalWallets: number;
  feePeriod: string;
  symbol: string;
  blockchainNameAbbreviation: string;
  tokenId: number;
}

/** 计息历史明细行。 */
export interface AccrualHistoryItem extends InterestRow {
  ruleRecordId: number;
  interestRuleId: number;
  walletAddress: string;
  walletType: string;
  blockchainName: string;
  interestPolicyName: string;
  balance: number;
  symbol: string;
  accrualAmount: number;
  billType?: number; // 透支表独有列
}

/** 计息历史明细筛选。 */
export interface AccrualHistoryListFilters {
  tokenId: number;
  feePeriod: string;
  feeType: number;
  walletAddress?: string;
}

// ── Transactions（交易）域 ────────────────────────────────────────────────────

/** 计息交易列表行（rowKey=interestRuleId）。 */
export interface TokenBill extends InterestRow {
  interestRuleId: number;
  tokenBillId: number;
  postTime: string;
  tokenName: string;
  symbol: string;
  blockchainName: string;
  feeType: number;
  postRealityCount: number;
  postAccruedCount: number;
  status: number; // 1-40
}

/** 交易列表筛选。 */
export interface TokenBillListFilters {
  postStartTime?: string;
  postEndTime?: string;
  tokenId?: string;
  blockchainId?: string;
  feeType?: string;
  status?: string;
}

/** 交易批次基本信息。 */
export interface TokenBillDetail {
  tokenBillId: number;
  postTime: string;
  failedWalletCount: number;
  tokenName: string;
  feeType: number;
  totalWalletCount: number;
  symbol: string;
  blockchainName: string;
  postAccruedCount: number;
  postRealityCount: number;
}

/** 交易明细行。 */
export interface TransactionRecord extends InterestRow {
  ruleRecordId: number;
  interestRuleId: number;
  walletAddress: string;
  walletType: string;
  blockchainName: string;
  feeStartDate: string;
  feeEndDate: string;
  postAccruedCount: number;
  postRealityCount: number;
  symbol: string;
  txTime: string;
  txHash: string;
  status: number;
}

/** 交易明细筛选。 */
export interface TransactionRecordListFilters {
  tokenBillId: number;
  walletAddress?: string;
  status?: string;
}

/** 交易操作记录行。 */
export interface TransactionOperationRecord extends InterestRow {
  ruleRecordId: number;
  recordType: number;
  createUserName: string;
  createTime: string;
  status: number;
  taskId?: string;
  busCode?: string;
}

/** 交易操作记录筛选。 */
export interface TransactionOperationListFilters {
  tokenBillId: number;
}

// ── 交易写操作 ────────────────────────────────────────────────────────────────

/** 交易过账请求体。 */
export interface TokenBillPostParams {
  tokenBillId: number;
}

// ── 表单值类型 ────────────────────────────────────────────────────────────────

/** 存款策略表单值（react-hook-form）。 */
export interface DepositPolicyFormValues {
  interestPolicyName: string;
  accountType: number;
  interestCalculationMethod: number;
  annualInterestRate?: string;
  selectType: string; // 'add' | 'minus' (i18n)
  effectiveTime: string;
  day: string; // 'Daily' (i18n)
  month: string; // 'Day' (i18n)
  calculateTimeDay: string;
  calculateTimeMonth: string;
  calculateDayMonth: number;
  calculateDigitDay?: number;
  calculateDigitMonth?: number;
  saveDetails: SaveDetailsFormItem[];
}

/** 透支策略表单值。 */
export interface OverdraftPolicyFormValues {
  interestPolicyName: string;
  accountType: number;
  annualInterestRate: string;
  effectiveTime: string;
  day: string;
  month: string;
  calculateTimeDay: string;
  calculateTimeMonth: string;
  calculateDigitDay?: number;
  calculateDigitMonth?: number;
}

/** 分段利率表单行（useFieldArray）。 */
export interface SaveDetailsFormItem {
  minValue: number | string;
  maxValue: number | string;
  interestRate: string;
  type: string; // 'add' | 'minus' (i18n)
}

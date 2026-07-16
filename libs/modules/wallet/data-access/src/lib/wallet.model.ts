/**
 * Wallet 模块类型定义（按子模块分节）。
 *
 * 迁移自 td-manage `src/pages/wallet/*` + `src/lib/api/{wallet-type,wallet-state,user-wallet-stable,common}.ts`。
 * 列表行均注入字符串 `id` 以满足 DataTable `{ id: string }` 契约（journal 模式）。
 * 字段名遵循后端驼峰；仅建模页面消费的字段，未消费的透传字段用宽松索引签名兜底。
 */

// ── 公共类型 ──────────────────────────────────────────────────────────────────

/** 列表行注入 id 后的基类契约（DataTable 要求）。 */
export interface WalletRow {
  id: string;
}

/** 服务端分页参数。 */
export interface WalletListParams<F> {
  pageNum: number;
  pageSize: number;
  filters: F;
}

/** 分页响应公共结构（源项目 `{ page, rows }`）。 */
export interface WalletListPage {
  pageNum?: number;
  pageSize?: number;
  total?: number;
  pages?: number;
}

export interface WalletListResponse<R extends WalletRow> {
  page?: WalletListPage;
  rows: R[];
}

/** stablecoin 启用搜索项（GET common/stablecoin/enabled/searches）。 */
export interface StablecoinSearchOption {
  stablecoinId: number;
  name: string;
  symbol?: string;
  currencySymbol?: string;
  blockchainNameAbbreviation?: string;
  issueType?: number;
  state?: number;
  [k: string]: unknown;
}

/** 区块链下拉项（GET common/blockchain/list）。 */
export interface BlockchainOption {
  key?: number | string;
  value?: string;
  status?: number;
  label?: string;
  [k: string]: unknown;
}

/** tokenType 下拉项（GET common/tokenType/list）。 */
export interface TokenTypeOption {
  key?: number | string;
  value?: string;
  label?: string;
  [k: string]: unknown;
}

// ── operational-wallet ────────────────────────────────────────────────────────

export interface OperationalWallet extends WalletRow {
  ruleId?: number;
  ruleWalletId?: number;
  walletAddress?: string;
  accountType?: number;
  feeType?: number;
  tokenName?: string;
  walletType?: string;
  blockchainName?: string;
  balance?: string | number;
  symbol?: string;
  createTime?: number | string;
  state?: number;
  [k: string]: unknown;
}

export interface OperationalWalletFilters {
  stablecoinId?: number;
  blockchainKey?: string | number;
  accountType?: number;
  feeType?: number;
  state?: number;
  walletAddress?: string;
}

export interface OperationalWalletDetail {
  walletAddress?: string;
  feeType?: number;
  state?: number;
  accountType?: number;
  createUserName?: string;
  createTime?: number | string;
  blockchainName?: string;
  ruleWalletId?: number;
  [k: string]: unknown;
}

export interface OperationalTx extends WalletRow {
  txFrom?: string;
  txTo?: string;
  blockchainName?: string;
  txType?: number | string;
  txAmount?: string | number;
  symbol?: string;
  txTime?: number | string;
  txHash?: string;
  [k: string]: unknown;
}

export interface OperationalOpRecord extends WalletRow {
  operateType?: number;
  oldWalletAddress?: string;
  walletAddress?: string;
  blockchainName?: string;
  createUser?: string;
  createTime?: number | string;
  txHash?: string;
  txTime?: number | string;
  operationStatus?: number;
  taskId?: string;
  busCode?: string;
  [k: string]: unknown;
}

// ── user-wallet ───────────────────────────────────────────────────────────────

export interface UserWallet extends WalletRow {
  walletId?: number;
  walletAddress?: string;
  blockchainName?: string;
  spName?: string;
  custodyModel?: number;
  kycRequired?: number;
  tdName?: string;
  tokenType?: number;
  walletType?: string;
  stablecoinCount?: string | number;
  symbol?: string;
  state?: number;
  walletState?: number;
  createTime?: number | string;
  stablecoinFreezeRecordId?: string;
  stablecoinUnfreezeRecordId?: string;
  walletTypeChangeRecordId?: string;
  tdState?: number;
  kycType?: number;
  [k: string]: unknown;
}

export interface UserWalletFilters {
  stablecoinId?: number;
  blockchainKey?: string | number;
  tokenType?: number;
  walletAddress?: string;
  state?: number;
  walletType?: string;
}

export interface UserWalletDetail {
  walletAddress?: string;
  spName?: string;
  tokenType?: number;
  tdName?: string;
  blockchainName?: string;
  walletType?: string;
  custodyModel?: number;
  kycRequired?: number;
  maxTxCountDaily?: number;
  maxTxCountPer?: number;
  stablecoinLimitCount?: string | number;
  createTime?: number | string;
  withDrawTime?: number | string;
  state?: number;
  symbol?: string;
  walletId?: number;
  // 基金字段（MMF 相关展示）
  fundName?: string;
  fundCode?: string;
  fundType?: number;
  riskLevel?: number;
  fundAssetValue?: string | number;
  fundAssetCurrency?: string;
  fundInception?: number | string;
  dividendMethod?: string;
  [k: string]: unknown;
}

export interface UserTx extends WalletRow {
  txFrom?: string;
  txTo?: string;
  blockchainName?: string;
  txType?: number | string;
  txAmount?: string | number;
  symbol?: string;
  txTime?: number | string;
  txHash?: string;
  submissionPolicy?: string;
  [k: string]: unknown;
}

export interface UserOpRecord extends WalletRow {
  txHash?: string;
  operateType?: number;
  operateNum?: string | number;
  newStatus?: number;
  oldStatus?: number;
  createUser?: string;
  createTime?: number | string;
  operationStatus?: number;
  taskId?: string;
  businessCode?: string;
  [k: string]: unknown;
}

export interface AccrualRecord extends WalletRow {
  accrualTime?: number | string;
  feeType?: number;
  feePeriod?: string;
  accrualAmount?: string | number;
  tokenCurrencySymbol?: string;
  blockchainName?: string;
  [k: string]: unknown;
}

export interface DistributeRecord extends WalletRow {
  payableOn?: number | string;
  earningsDate?: number | string;
  dividendAmount?: string | number;
  dividendAmountCurrency?: string;
  dividendUnits?: string | number;
  dividendUnitsSymbol?: string;
  txTime?: number | string;
  txHash?: string;
  status?: number;
  [k: string]: unknown;
}

export interface AuthRecord extends WalletRow {
  walletAddress?: string;
  type?: number;
  blockchainName?: string;
  amount?: string | number;
  symbol?: string;
  operationTime?: number | string;
  status?: number;
  txHash?: string;
  authId?: string | number;
  [k: string]: unknown;
}

export interface AvailableWalletType {
  walletType?: string;
  ruleId?: number;
  [k: string]: unknown;
}

// ── wallet-type ───────────────────────────────────────────────────────────────

/** 卡片网格项（head/list）。 */
export interface WalletTypeCard extends WalletRow {
  ruleId?: number;
  name?: string;
  accountType?: number;
  maxTxCountPer?: number;
  maxTxCountDaily?: number;
  stablecoinCount?: string | number;
  minimumBalance?: string | number;
  maximumRedeemLimit?: string | number;
  createUser?: string;
  createTime?: number | string;
  state?: number;
  operate?: number;
  fundType?: number;
  riskLevel?: number;
  fundAssetValue?: string | number;
  currencySymbol?: string;
  fundInceptionTime?: number | string;
  fundlastPayoutTime?: number | string;
  tdSymbol?: string;
  stablecoinId?: number;
  walletTypeCode?: string;
  dailyStatisticalTime?: string;
  [k: string]: unknown;
}

/** 两张表行（list）。 */
export interface WalletTypeTableRow extends WalletRow {
  recordId?: string | number;
  name?: string;
  accountType?: number;
  createUser?: string;
  createTime?: number | string;
  taskId?: string;
  businessCode?: string;
  state?: number;
  [k: string]: unknown;
}

/** 详情（head/details，常规 + mff 共用）。 */
export interface WalletTypeDetail {
  ruleId?: number;
  name?: string;
  tokenName?: string;
  blockchainName?: string;
  accountType?: number;
  walletTypeCode?: string;
  fundType?: number;
  riskLevel?: number;
  fundAssetValue?: string | number;
  currencySymbol?: string;
  fundInceptionTime?: number | string;
  createUser?: string;
  createTime?: number | string;
  status?: number;
  state?: number;
  // 限额
  singleTradingLimit?: number;
  dailyTradingLimit?: number;
  balanceLimit?: number;
  minimumBalance?: number;
  dailyRedeemLimit?: number;
  tdSymbol?: string;
  // 维护费
  maintenanceFee?: string | number;
  minimumBalanceFee?: string | number;
  feeCycle?: number;
  accountFeesWalletAddress?: string;
  // 利息/透支
  interestFeatureEnablement?: number;
  arrangedInterestPolicyId?: number;
  arrangedInterestPolicyName?: string;
  arrangedInterestRate?: string | number;
  arrangedInterestEffectiveDate?: number | string;
  arrangedCalculateType?: number;
  arrangedInterestAccrualApplicationTime?: number | string;
  arrangedOverdraftAmount?: string | number;
  overdraftBufferAmount?: string | number;
  overdraftBufferPeriod?: number;
  unarrangedOverdraftAmount?: string | number;
  unarrangedOverdraftFee?: string | number;
  unarrangedOverdraftFeeMax?: string | number;
  unarrangedInterestPolicyId?: number;
  unarrangedInterestPolicyName?: string;
  unarrangedInterestRate?: string | number;
  unarrangedInterestEffectiveDate?: number | string;
  receivingOverdraftFeeWalletAddress?: string;
  receivingOverdraftInterestWalletAddress?: string;
  depositInterestWalletAddress?: string;
  accountClosureInterestWalletAddress?: string;
  // MMF
  dailyStatisticalTime?: string;
  [k: string]: unknown;
}

export interface AccountTypeOption {
  accountType?: number;
  [k: string]: unknown;
}

export interface InterestRateTier {
  minValue?: string | number;
  maxValue?: string | number;
  interestRate?: string | number;
}

export interface InterestPolicy {
  interestRuleId?: number;
  interestPolicyName?: string;
  annualInterestRates?: InterestRateTier[];
  effectiveDate?: number | string;
  calculateType?: number;
  [k: string]: unknown;
}

/** 余额计算结果（earnings 弹窗）。 */
export interface BalanceCalcResult {
  dailyStatisticalTime?: number | string;
  totalUnits?: string | number;
  [k: string]: unknown;
}

/** 收益计算结果。 */
export interface EarningsCalcResult {
  earningsPerUnit?: string | number;
  [k: string]: unknown;
}

// ── mff view ──────────────────────────────────────────────────────────────────

export interface DailyYieldRow extends WalletRow {
  fundInceptionTimeStart?: number | string;
  totalUnits?: string | number;
  tokenCurrencySymbol?: string;
  totalEarnings?: string | number;
  currencySymbol?: string;
  earningPerUnits?: string | number;
  totalWallets?: number;
  createdBy?: string;
  payableOn?: number | string;
  status?: number;
  billCode?: string;
  [k: string]: unknown;
}

export interface DividendRow extends WalletRow {
  walletAddress?: string;
  stablecoinCount?: string | number;
  stablecoinSymbol?: string;
  dividendAmount?: string | number;
  dividendAmountCurrency?: string;
  dividendUnits?: string | number;
  txTime?: number | string;
  txHash?: string;
  status?: number;
  [k: string]: unknown;
}

export interface DividendSummary {
  earningsDate?: number | string;
  payableOn?: number | string;
  totalUnits?: string | number;
  totalUnitsSymbol?: string;
  totalEarnings?: string | number;
  totalEarningsCurrency?: string;
  perEarningsUnits?: string | number;
  totalWallets?: number;
  [k: string]: unknown;
}

// ── mutation payloads ─────────────────────────────────────────────────────────

/** 冻结/解冻资金 type：6=冻结，7=解冻。 */
export interface FundsOperatePayload {
  type: 6 | 7;
  stablecoinCount: string | number;
  remarks?: string;
  walletId: number;
}

/** 冻结/解冻钱包 type：2=冻结，3=解冻。 */
export interface WalletOperatePayload {
  type: 2 | 3;
  remarks?: string;
  walletId: number;
}

export interface ChangeWalletTypePayload {
  reason: string;
  newRuleId: number;
  walletId: number;
}

export interface UpdateWalletTypeStatePayload {
  ruleId: number;
  walletState: 3 | 4; // 3=禁用，4=启用
}

export interface EarningsSendPayload {
  ruleId: number;
  totalEarnings: string | number;
  earningsDate: number | string;
}

/** 生成钱包 keystore。 */
export interface KeystorePayload {
  chainType: 'evm';
  password: string; // 已加密
}

export interface KeystoreResult {
  walletAddress?: string;
  keystore?: string;
  [k: string]: unknown;
}

/** 常规 wallet-type 新增/编辑 payload（宽松，字段依 accountType 分支）。 */
export interface WalletTypeSavePayload {
  tdId?: number;
  ruleId?: number; // 编辑
  name?: string;
  accountType?: number;
  balanceLimit?: number;
  dailyRedeemLimit?: number;
  dailyTradingLimit?: number;
  minimumBalance?: number;
  singleTradingLimit?: number;
  interestFeatureEnablement?: number;
  [k: string]: unknown;
}

/** MMF wallet-type 新增/编辑 payload。 */
export interface MmfWalletTypeSavePayload {
  tdId?: number;
  ruleId?: number; // 编辑
  name?: string;
  walletTypeCode?: string;
  fundType?: number;
  riskLevel?: number;
  fundAssetValue?: number;
  fundInceptionTime?: number;
  depositInterestWalletAddress?: string;
  depositInterestKeyStore?: string;
  depositInterestKeyStorePassword?: string;
  dailyStatisticalTime?: string;
  [k: string]: unknown;
}

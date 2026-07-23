/**
 * Reconciliation 模块类型定义（real-time + reserve 双子域）。
 *
 * 迁移自 td-manage `src/typings/token-finance/data-contracts.ts`（Swagger 生成）
 * 的 reconciliation 子集 + 旧 `reconciliation/{real-time,reserve}/api.ts` 请求/响应类型。
 *
 * 列表行注入字符串 `id` 以满足 DataTable `{ id: string }` 契约（journal 模式，
 * 对齐 approval-manage）。字段名遵循后端驼峰。
 */

// ── 分页/响应公共结构 ──────────────────────────────────────────────────────────

/** 列表行注入 id 后的基类契约（DataTable 要求）。 */
export interface ReconciliationRow {
  id: string;
}

/** 服务端分页请求参数。 */
export interface ReconciliationListParams<F> {
  pageNum: number;
  pageSize: number;
  filters: F;
}

/** 分页响应公共结构（后端 `{ page, rows }`）。 */
export interface ReconciliationListPage {
  pageNum?: number;
  pageSize?: number;
  total?: number;
  pages?: number;
}

export interface ReconciliationListResponse<
  R extends ReconciliationRow,
> {
  page?: ReconciliationListPage;
  rows: R[];
}

/** 单对象响应壳（后端 `{ code, message, data }`，apiClient 自动解包）。 */
export interface ReconciliationInfo<T> {
  code: number;
  message?: string;
  data: T;
}

// ── Real-time (Token) 域 ───────────────────────────────────────────────────────

/** Token 对账汇总（列表行，rowKey=tokenId）。 */
export interface TokenReconSummaryRespVo extends ReconciliationRow {
  tokenId: number;
  tokenName: string;
  tokenCode?: string;
  /** 1=Stablecoin, 5=TD。 */
  tokenType: number;
  blockchainName?: string;
  bookNo?: string;
  financeBookName?: string;
  currencySymbol?: string;
  matchedCount: number;
  unmatchedCount: number;
  actionedCount: number;
  lastReconciliationTime?: string;
  reconStartTime?: string;
  /** 列表行回显，用于动态筛选项构造。 */
  blockchainId?: number | string;
}

/** Token 对账列表请求筛选。 */
export interface TokenReconListReqVo {
  tokenName?: string;
  tokenType?: number;
  blockchainId?: number | string;
  financeBookName?: string;
  bookNo?: string;
  currencyCode?: string;
  lastReconciliationDateStart?: string;
  lastReconciliationDateEnd?: string;
}

export interface TokenReconBasicDetailReqVo {
  tokenId: number;
}

export interface TokenReconBasicDetailRespVo {
  tokenName: string;
  tokenSymbol?: string;
  tokenType: number;
  blockchainName?: string;
  financeBookName?: string;
  financeBookId?: number;
  bookNo?: string;
  currencySymbol?: string;
  createdBy?: string;
  createTime?: string;
  lastReconciliationTime?: string;
  matchedCount: number;
  unmatchedCount: number;
  actionedCount: number;
}

/** Tx 明细行（rowKey=reconciliationTxId）。 */
export interface TxReconDetailRespVo extends ReconciliationRow {
  reconciliationNo: string;
  reconciliationTxId: number;
  txHash?: string;
  tranId?: string;
  /** 5/10/15/20/25。 */
  txType: number;
  blockHeight?: number;
  financeAmount?: number;
  chainAmount?: number;
  financeCount?: number;
  chainCount?: number;
  currencyCode?: string;
  tokenSymbol?: string;
  financeAccountAddress?: string;
  chainAccountAddress?: string;
  financeTxTime?: string;
  chainTxTime?: string;
  /** 1=System Only, 2=On-chain Only, 3=Amount Mismatched。 */
  unmatchedType?: number;
  /** 1-6。 */
  reconciliationStatus: number;
  lastReconciliationTime?: string;
  canPostSuspense?: boolean;
}

/** Tx 明细列表请求筛选。 */
export interface TxReconListReqVo {
  tokenId?: number;
  reconciliationDateStart?: string;
  reconciliationDateEnd?: string;
  txStartTime?: string;
  txEndTime?: string;
  keyword?: string;
  txType?: number;
  reconciliationStatus?: number;
}

/** 会计分录原子（real-time + reserve 共用）。 */
export interface JournalEntry {
  accountCode: string;
  accountName?: string;
  /** 1=Dr, 2=Cr。 */
  direction: number;
  amount: number;
  tokenCount?: number;
  tokenSymbol?: string;
  transactionId?: string;
}

/** 链上详情（recon-log 子结构）。 */
export interface OnchainDetails {
  hash?: string;
  blockHeight?: number;
  fromAddress?: string;
  toAddress?: string;
  amount?: number;
  tokenCount?: number;
  tokenSymbol?: string;
  txTime?: string;
}

/** 原始分录。 */
export interface OriginalEntry {
  tranId?: string;
  postingDate?: string;
  entries: JournalEntry[];
}

/** 挂账分录。 */
export interface SuspenseEntries {
  postingDate?: string;
  tranId?: string;
  exceptionContext?: string;
  processedBy?: string;
  processedTime?: string;
  entries: JournalEntry[];
  originalAmount?: number;
  adjustedAmount?: number;
  outstandingAmount?: number;
}

/** 调整历史项（后端自由结构）。 */
export interface AdjustmentHistoryItem {
  [k: string]: unknown;
}

export interface TxReconLogReqVo {
  reconciliationTxId: number;
}

export interface TxReconLogRespVo {
  reconciliationTime?: string;
  reconciliationNo: string;
  reconciliationTxId: number;
  txHash?: string;
  txType: number;
  reconciliationStatus: number;
  currencySymbol?: string;
  financeBookName?: string;
  bookNo?: string;
  tranId?: string;
  onchainDetails?: OnchainDetails;
  originalEntry?: OriginalEntry;
  suspenseEntries?: SuspenseEntries;
  /** Post 挂账回显建议分录（只读，不可手增）。 */
  suggestedSuspenseEntries?: JournalEntry[];
  adjustmentHistory?: AdjustmentHistoryItem[];
}

/** real-time 挂账提交。 */
export interface PostSuspenseReqVo {
  reconciliationTxId: number;
  exceptionContext: string;
  postingDate: string;
  suspenseEntries: JournalEntry[];
}

export interface PostSuspenseRespVo {
  reconciliationNo: string;
  reconciliationTxId: number;
  /** =5。 */
  newStatus: number;
}

/** 末级科目（跨域复用：reserve ReservePostToSuspenseModal 也调 Token 域接口）。 */
export interface AccountBrief {
  accountCode: string;
  accountName?: string;
  /** 1-5 科目类型。 */
  type?: number;
  /** 1=Dr, 2=Cr。 */
  direction?: number;
}

export interface LeafAccountsReqVo {
  financeBookId: number;
}

export interface LeafAccountsRespVo {
  financeBookId: number;
  debitAccounts: AccountBrief[];
  creditAccounts: AccountBrief[];
}

// ── Reserve 域 ─────────────────────────────────────────────────────────────────

export interface TokenBrief {
  tokenId: number;
  tokenName: string;
  tokenCode?: string;
  blockchainName?: string;
}

/** 储备资产汇总（列表行，rowKey=reserveAccountId）。 */
export interface ReserveAssetSummaryRespVo extends ReconciliationRow {
  reserveAccountId: number;
  reserveAccountName: string;
  reserveAccount?: string;
  currencySymbol?: string;
  assetValue?: number;
  bookNo?: string;
  financeBookName?: string;
  associatedTokens: TokenBrief[];
  matchedCount: number;
  exceptionsCount: number;
  lastReconciliationTime?: string;
  reconStartTime?: string;
}

export interface ReserveAssetListReqVo {
  reserveAssetName?: string;
  currencySymbol?: string;
  financeBookName?: string;
  bookNo?: string;
  lastReconciliationDateStart?: string;
  lastReconciliationDateEnd?: string;
}

export interface ReserveAssetBasicDetailReqVo {
  reserveAccountId: number;
}

export interface ReserveAssetBasicDetailRespVo {
  reserveAssetName?: string;
  reserveAccountName: string;
  assetValue?: number;
  currencySymbol?: string;
  financeBookName?: string;
  bookNo?: string;
  createdBy?: string;
  associatedTokens: TokenBrief[];
  createTime?: string;
  lastReconciliationTime?: string;
  matchedCount: number;
  exceptionsCount: number;
}

/** Reserve 明细行（rowKey=reconciliationReserveId）。 */
export interface ReserveReconDetailRespVo extends ReconciliationRow {
  reconciliationNo: string;
  reconciliationReserveId: number;
  lastReconciliationTime?: string;
  txHash?: string;
  /** 1=Mint, 2=Reserve Out/Melt。 */
  type: number;
  expectedAmount?: number;
  actualAmount?: number;
  tokenCount?: number;
  tokenUnitPrice?: number;
  availableBalanceAtApproval?: number;
  /** actual-available，负=超额。 */
  reserveDiff?: number;
  /** 0-5。 */
  reconciliationStatus: number;
  orderSerialNumber?: string;
  currency?: string;
  tokenSymbol?: string;
}

export interface ReserveReconListReqVo {
  reserveAccountId: number;
  reconciliationDateStart?: string;
  reconciliationDateEnd?: string;
  txStartTime?: string;
  txEndTime?: string;
  keyword?: string;
  type?: number;
  reconciliationStatus?: number;
}

export interface MintableCapacity {
  mintableCapacity?: number;
  mintableCapacityCurrency?: string;
  mintableCapacityToken?: number;
  mintableCapacityTokenSymbol?: string;
  snapshotTime?: string;
}

export interface ReserveActualExecution {
  senderWalletAddress?: string;
  receiverWalletAddress?: string;
  executionAmount?: number;
  executionAmountCurrency?: string;
  executionTokenAmount?: number;
  executionTokenSymbol?: string;
  executionTime?: string;
  executionTxHash?: string;
}

export interface MeltActualExecution {
  transactionRef?: string;
  refundAmount?: number;
  refundCurrencySymbol?: string;
  receiverBankAccount?: string;
  receiverBankName?: string;
  executionTime?: string;
}

export interface TransactionRequest {
  meltingAmount?: number;
  meltingAmountCurrency?: string;
  meltingTokenAmount?: number;
  meltingTokenSymbol?: string;
  tokenName?: string;
  tokenType?: number;
  blockchainName?: string;
  createdBy?: string;
  createdTime?: string;
}

export interface ReserveReconLogReqVo {
  reconciliationReserveId: number;
}

export interface ReserveReconLogRespVo {
  reconciliationTime?: string;
  reconciliationNo: string;
  reconciliationReserveId: number;
  txType?: number;
  reconciliationStatus: number;
  financeBookName?: string;
  financeBookId?: number;
  currencySymbol?: string;
  txHash?: string;
  txAmount?: number;
  txAmountCurrency?: string;
  tokenCount?: number;
  tokenSymbol?: string;
  mintableCapacity?: MintableCapacity;
  actualExecution?: ReserveActualExecution;
  transactionRequest?: TransactionRequest;
  meltActualExecution?: MeltActualExecution;
}

/** reserve 挂账提交（后端端点缺失，暂以 feature-flag 隐藏，见 R1）。 */
export interface ReservePostSuspenseReqVo {
  reconciliationReserveId: number;
  exceptionContext: string;
  suspenseEntries: JournalEntry[];
}

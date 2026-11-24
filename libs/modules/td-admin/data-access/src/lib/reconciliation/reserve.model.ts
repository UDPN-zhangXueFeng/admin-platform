import type { JournalEntry, ReconciliationRow } from './reconciliation.model';

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
  /** 对账日期范围，startOfDay / endOfDay 毫秒（对齐旧 CustomTable RangePicker）。 */
  reconciliationDateStart?: number;
  reconciliationDateEnd?: number;
  txStartTime?: number;
  txEndTime?: number;
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

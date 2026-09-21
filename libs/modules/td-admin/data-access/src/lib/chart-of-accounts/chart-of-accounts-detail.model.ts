/**
 * Chart of Accounts 详情页领域模型（COA 编辑 + EOD Statements）。
 *
 * 1:1 迁移自源项目 `td-manage` 的 `src/lib/components/chart-of-accounts/view/types.ts`，
 * 仅做两项适配：(1) DataTable 契约要求 `id: string`；(2) `Dayjs` → epoch 毫秒(number)
 * 或 ISO 字符串(string)，对齐目标项目 date-fns 体系。
 * 用户范围仅含 COA 编辑 tab + EOD Statements tab（Trial Balance / Operation Records 暂不迁移）。
 */

// ── 公用枚举 ──────────────────────────────────────────────────────────
export type CoaStatus = 'active' | 'inactive' | 'pending-submit';

export type CoaAction =
  | 'new-primary-account'
  | 'new-sub-account'
  | 'edit'
  | 'deactivate'
  | 'activate';

export type EodAccountingStatus = 'unbalanced' | 'balanced';

export type EodClearingStatus =
  | 'none'
  | 'settled'
  | 'suspensed'
  | 'adjusted'
  | 'pending';

// ── COA 树 ────────────────────────────────────────────────────────────
/** COA 树扁平行（DataTable 渲染单元，`id` = `key`）。 */
export interface CoaRow {
  id: string;
  key: string;
  rowType: 'section' | 'item';
  sectionType?: 'assets' | 'liabilities';
  accountType?: 'assets' | 'liabilities';
  financeBookId?: number;
  bookAccountId?: number;
  parentCode?: string;
  level?: number;
  depth?: number;
  typeValue?: number;
  directionValue?: number;
  accountCode?: string;
  accountName?: string;
  description?: string;
  balanceSide?: string;
  allowPosting?: boolean;
  suspenseAccount?: boolean;
  status?: CoaStatus;
  actions?: CoaAction[];
}

/** 后端 COA 树节点（递归）。 */
export interface CoaTreeNodeResp {
  bookAccountId?: number;
  financeBookId?: number;
  accountCode?: string;
  accountName?: string;
  parentCode?: string;
  level?: number;
  type?: number | string;
  direction?: number | string;
  allowPosting?: number | string | boolean;
  suspenseAccount?: number | string | boolean;
  status?: number | string;
  remarks?: string;
  sectionType?: string;
  accountType?: string;
  children?: CoaTreeNodeResp[];
}

/** 单个账户新建 / 编辑保存请求。 */
export interface BookAccountSaveReqVO {
  bookAccountId?: number;
  financeBookId: number;
  accountCode: string;
  accountName: string;
  parentCode?: string;
  level?: number;
  type: number;
  direction?: number;
  allowPosting?: number;
  suspenseAccount?: number;
  remarks?: string;
}

/** 批量保存请求。 */
export interface BookAccountBatchSaveReqVO {
  financeBookId: number;
  accounts: BookAccountSaveReqVO[];
}

/** 草稿账户（编辑态，待批量保存）。 */
export interface CoaDraftAccount extends BookAccountSaveReqVO {
  draftType: 'new-primary-account' | 'new-sub-account' | 'edit';
  draftKey: string;
}

/** 启用 / 停用请求。 */
export interface BookAccountToggleReqVO {
  financeBookId: number;
  bookAccountIds: number[];
}

// ── COA 编辑器表单 / Modal 状态 ───────────────────────────────────────
export interface AccountEditorFormValues {
  accountCode?: string;
  accountCodeSuffix?: string;
  accountName?: string;
  allowPosting?: boolean;
  suspenseAccount?: boolean;
  description?: string;
}

export interface CoaToggleFormValues {
  comment?: string;
  childAccountKeys?: string[];
}

export type CoaModalState =
  | { type: 'new-primary-account'; sectionType: 'assets' | 'liabilities' }
  | { type: 'new-sub-account' | 'edit' | 'deactivate' | 'activate'; record: CoaRow }
  | null;

// ── EOD Statements ───────────────────────────────────────────────────
/** EOD 列表行（DataTable 渲染单元）。 */
export interface EodStatementRow {
  id: string;
  key: string;
  financeBookEodId?: number;
  eodDate: string;
  /** epoch 毫秒，用于排序。 */
  eodDateValue: number;
  totalAssets: string;
  totalLiabilities: string;
  suspenseEntries: number;
  variance: string;
  varianceValue: number;
  createdOn: string;
  accountingStatus: EodAccountingStatus;
  clearingStatus: EodClearingStatus;
  closedBy: string;
  actionType: 'details' | 'post-to-suspense' | 'review-confirm';
}

/** 后端 EOD 余额行（分页接口返回项）。 */
export interface EodBalanceRowResp {
  postingDate?: string;
  totalAssets?: string | number;
  totalLiabilities?: string | number;
  currencyCode?: string;
  suspenseEntries?: number;
  createdOn?: number;
  accountingStatus?: number;
  clearingStatus?: number;
  processedBy?: string;
  financeBookEodId?: number;
  eodId?: number;
}

/** EOD 余额分页响应（unwrap 后）。 */
export interface EodBalancesPagedResp {
  page?: { total?: number };
  rows?: EodBalanceRowResp[];
  bookName?: string;
  currencyCode?: string;
}

/** 旧版 EOD 条目（兜底数据结构）。 */
export interface LegacyEodEntryResp {
  postingDate?: string;
  amount?: string | number;
  direction?: string;
  financeBookEodId?: number;
  eodId?: number;
}

export interface LegacyEodBalancesResp {
  currencyCode?: string;
  entries?: LegacyEodEntryResp[];
  suspenseEntries?: LegacyEodEntryResp[];
}

export interface EodFilterState {
  /** `[startMs, endMs]` inclusive，`null` 表示不限。 */
  range: [number, number] | null;
  clearingStatus?: EodClearingStatus;
}

/** EOD 明细：资产 / 负债账户行。 */
export interface EodDetailAccountRow {
  id: string;
  key: string;
  accountName: string;
  depth?: number;
  isGroup?: boolean;
  openingSide: string;
  opening: string;
  debit: string;
  credit: string;
  closingSide: string;
  closing: string;
}

/** EOD 明细：暂记分录行。 */
export interface EodSuspenseEntryRow {
  id: string;
  key: string;
  postingDate: string;
  voucherId: string;
  drCr: string;
  account: string;
  amount: string;
  transactionId: string;
  postingDateRowSpan?: number;
  voucherIdRowSpan?: number;
  transactionIdRowSpan?: number;
}

/** EOD 明细整体（drawer 展示）。 */
export interface EodStatementDetail {
  postingDate: string;
  bookName: string;
  bookId: string;
  currencyCode: string;
  processedBy: string;
  summaryTotalAssets: string;
  summaryTotalLiabilities: string;
  suspenseAssets: string;
  suspenseLiabilities: string;
  balancingStatus: EodAccountingStatus;
  exceptionContext: string;
  allowPostToSuspense: boolean;
  assetRows: EodDetailAccountRow[];
  liabilityRows: EodDetailAccountRow[];
  suspenseRows: EodSuspenseEntryRow[];
}

/** Post to Suspense 表单。 */
export interface PostToSuspenseFormValues {
  postingDate?: string;
  amount?: string;
  debitAccount?: string;
  creditAccount?: string;
  transactionId?: string;
  reason?: string;
}

// ── Basic Information ────────────────────────────────────────────────
export interface ChartOfAccountsBasicInfoResp {
  financeBookId?: number;
  bookNo?: string;
  bookName?: string;
  tokenType?: number;
  currencyCode?: string;
  status?: number;
  timeZone?: string;
  bookTemplateId?: number;
  tokens?: { bookTokenRelId?: number; tokenName?: string }[];
  eodCutoffTime?: string;
  lastEodPostingRun?: string;
  reserveAssetName?: string;
  statusName?: string;
  createdBy?: string;
  createdOn?: number;
}

export type BasicInfoStatus = 'active' | 'inactive';

export interface BasicInfoViewModel {
  financialBookName: string;
  status: BasicInfoStatus;
  bookId: string;
  reserveAssetName: string;
  currency: string;
  tokenType: number;
  tokens: string;
  eodCutoffTime: string;
  lastEodPostingRun: string;
  createdBy: string;
  createdOn: string;
}

/** 后端 EOD 明细中的账户余额项（结构多变，字段宽松）。 */
export interface EodDetailAccountBalanceItem {
  eodAccountBalanceId?: number;
  accountCode?: string;
  accountName?: string;
  openingBalance?: number;
  debitBalance?: number;
  creditBalance?: number;
  closingBalance?: number;
  currencyCode?: string;
}

/**
 * 后端 EOD 明细原始响应（EodDetailRespVo，结构多变）。
 * `buildEodStatementDetail` 将其转换为领域 `EodStatementDetail`。
 */
export interface EodDetailRespVo {
  postingDate?: string;
  bookName?: string;
  financialBookName?: string;
  bookNo?: string;
  bookId?: string;
  financeBookId?: number | string;
  currencyCode?: string;
  totalAssets?: number | string;
  totalLiabilities?: number | string;
  accountingStatus?: number;
  processedBy?: string;
  closedBy?: string;
  exceptionContext?: string;
  exceptionReason?: string;
  reason?: string;
  suspenseAssets?: number;
  suspenseAssetAmount?: number;
  suspenseLiabilities?: number;
  suspenseLiabilityAmount?: number;
  accountBalances?: EodDetailAccountBalanceItem[];
  suspenseEntries?: unknown[];
  suspenseEntryRows?: unknown[];
  suspenseEntryList?: unknown[];
  [key: string]: unknown;
}

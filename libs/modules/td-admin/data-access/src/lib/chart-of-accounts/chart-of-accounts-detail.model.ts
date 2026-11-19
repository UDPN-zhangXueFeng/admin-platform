/**
 * Chart of Accounts 详情页领域模型（COA 编辑 + EOD Statements）。
 *
 * 1:1 迁移自源项目 `td-manage` 的 `src/lib/components/chart-of-accounts/view/types.ts`，
 * 仅做两项适配：(1) DataTable 契约要求 `id: string`；(2) `Dayjs` → epoch 毫秒(number)
 * 或 ISO 字符串(string)，对齐目标项目 date-fns 体系。
 * 覆盖详情页全部 5 个 tab：Basic Information / COA 编辑 / EOD Statements /
 * Trial Balance / Operation Records。
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

/**
 * Post to Suspense 弹窗配置（由选中 EOD 行的 totals/variance + COA 可过账科目计算）。
 * `defaultDebitAccount` / `defaultCreditAccount` 为 COA 行 `key`，用于表单预填。
 */
export interface PostToSuspenseConfig {
  totalAssets?: string;
  totalLiabilities?: string;
  /** 已格式化的不平衡金额（千分位 + 2 位小数）。 */
  amount?: string;
  currency?: string;
  directionText?: string;
  /** EOD 日期 `YYYY-MM-DD`，用于预填 Posting Date。 */
  postingDate?: string;
  defaultDebitAccount?: string;
  defaultCreditAccount?: string;
  debitOptions?: { label: string; value: string }[];
  creditOptions?: { label: string; value: string }[];
}

// ── Trial Balance ────────────────────────────────────────────────────
export type TrialBalanceAsOfOption =
  | 'end-of-last-eod'
  | 'end-of-last-month'
  | 'end-of-last-quarter'
  | 'end-of-last-year'
  | 'custom-date';

export interface TrialBalanceFilterState {
  asOf: TrialBalanceAsOfOption;
  /** `[startDate, endDate]`（`YYYY-MM-DD`），仅 `custom-date` 生效。 */
  customDateRange: [string, string] | null;
}

/** 试算平衡查询区间（展示用日期 + 后端用 epoch ms）。 */
export interface TrialBalanceRange {
  startDate: string;
  endDate: string;
  startTime: number;
  endTime: number;
}

/** 后端科目余额明细（递归）。 */
export interface TrialBalanceItemResp {
  bookAccountId?: number;
  accountCode?: string;
  accountName?: string;
  parentCode?: string;
  level?: number;
  /** 科目分组 1:ASSET 2:LIABILITY 3:EQUITY 4:INCOME_EXPENSE */
  sectionType?: number | string;
  openingBalance?: number | string;
  /** 期初方向 1:Dr 2:Cr */
  openingDrCr?: number | string;
  /** 本期发生额方向 1:Dr 2:Cr */
  activityDrCr?: number | string;
  periodDebit?: number | string;
  periodCredit?: number | string;
  closingBalance?: number | string;
  hasActivity?: boolean;
  children?: TrialBalanceItemResp[];
}

/** 试算平衡响应。 */
export interface TrialBalanceResp {
  bookName?: string;
  bookId?: string | number;
  currencyCode?: string;
  totalAssets?: number | string;
  totalLiabilities?: number | string;
  /** Balanced / Unbalanced */
  balancingCheck?: string;
  items?: TrialBalanceItemResp[];
}

/** 试算平衡表格行（DataTable 渲染单元）。 */
export interface TrialBalanceRow {
  id: string;
  key: string;
  sectionType: 'assets' | 'liabilities';
  accountCode: string;
  accountName: string;
  accountLabel: string;
  depth: number;
  isGroup: boolean;
  isSubtotal?: boolean;
  openingSide: string;
  opening: string;
  debit: string;
  credit: string;
  activitySide: string;
  closing: string;
  hasActivity: boolean;
}

/** 试算平衡汇总视图（标题由组件层按 as-of 文案拼装）。 */
export interface TrialBalanceSummary {
  periodText: string;
  totalAssets: string;
  totalLiabilities: string;
  balancingCheck: string;
  asOfDate: string;
  assetRows: TrialBalanceRow[];
  liabilityRows: TrialBalanceRow[];
}

/** 试算平衡事件类型（交易类型列，组件层按 i18n key 渲染）。 */
export type TrialBalanceEventType =
  | 'reserveIn'
  | 'fundingIn'
  | 'mint'
  | 'repositoryOut'
  | 'transfer'
  | 'repositoryIn'
  | 'melt'
  | 'reserveOut'
  | 'fundingOut';

/** 后端科目活动明细项。 */
export interface TrialBalanceActivityItemResp {
  postingAccountBalanceId?: number;
  accountCode?: string;
  accountName?: string;
  /** 部分后端版本在明细行回带账本信息（源 meta 回退链）。 */
  financialBookName?: string;
  bookName?: string;
  bookId?: string | number;
  bookNo?: string;
  financeBookId?: number | string;
  /** 方向 1:DEBIT 2:CREDIT */
  direction?: number | string;
  amount?: number | string;
  postingDate?: string;
  runningBalance?: number | string;
  offsettingAccountCode?: string;
  offsettingAccountName?: string;
  currencyCode?: string;
  eventCode?: string;
  eventType?: number | string;
  eventTypeName?: string;
  txCode?: string;
  tranId?: string;
  createTime?: number;
}

/** 后端科目活动响应。 */
export interface TrialBalanceActivityResp {
  bookNo?: string;
  bookName?: string;
  financialBookName?: string;
  bookId?: string | number;
  financeBookId?: number | string;
  currencyCode?: string;
  accountCode?: string;
  accountName?: string;
  parentCode?: string;
  level?: number;
  sectionType?: number;
  openingBalance?: number;
  periodDebit?: number;
  periodCredit?: number;
  closingBalance?: number;
  startDate?: string;
  endDate?: string;
  items?: TrialBalanceActivityItemResp[];
}

/** 科目活动明细行（Activity Drawer 表格）。 */
export interface TrialBalanceActivityRow {
  id: string;
  key: string;
  postingDate: string;
  transactionId: string;
  /** 后端返回的事件名称（优先展示）。 */
  eventTypeName?: string;
  /** 已解析的事件类型（组件层翻译）。 */
  eventTypeCode?: TrialBalanceEventType;
  /** 未识别时可回退展示的原始事件类型文本（源行为）。 */
  eventTypeRaw?: string;
  account: string;
  offsettingAccount: string;
  debitAmount: string;
  creditAmount: string;
  runningBalance: string;
  eventCode: string;
}

/** 科目活动抽屉头部元信息。 */
export interface TrialBalanceActivityMeta {
  financialBookName: string;
  bookId: string;
  startDateText?: string;
}

// ── Operation Records ────────────────────────────────────────────────
export type OperationType = 'create' | 'update' | 'activate' | 'deactivate';

/** 后端操作记录行。 */
export interface OperationRecordResp {
  financeBookRecordId?: number;
  financeBookId?: number;
  /** 操作类型 1:保存 2:修改 3:启用 4:停用 */
  recordType?: number;
  tokenType?: number;
  bookNo?: string;
  bookName?: string;
  status?: number;
  createTime?: number;
  operator?: string;
  comments?: string;
  taskId?: number;
  busCode?: string;
  /** 审批业务编号别名（源项目兼容 `busCode` 缺失时的回退字段）。 */
  businessCode?: string;
}

/** 操作记录分页响应。 */
export interface OperationRecordsPagedResp {
  page?: { total?: number };
  rows?: OperationRecordResp[];
}

/** 操作记录表格行（DataTable 渲染单元）。 */
export interface OperationRecordRow {
  id: string;
  key: string;
  operationType?: OperationType;
  taskId?: number;
  busCode?: string;
  createdBy: string;
  createdOn: string;
  comments: string;
  status?: number;
  detailNotes: string[];
}

/** 已应用的筛选条件（日期为 `[startMs, endMs]`）。 */
export interface OperationFilterState {
  operationType?: OperationType;
  creatorName?: string;
  creationDateRange: [number, number] | null;
}

/** 操作记录查询形状（后端 `recordType` 为大写字符串枚举）。 */
export type OperationRecordTypeParam =
  | 'Create'
  | 'Update'
  | 'Activate'
  | 'Deactivate';

/** 操作记录列表请求参数。 */
export interface OperationRecordListParams {
  recordType?: OperationRecordTypeParam;
  createdBy?: string;
  createTimeStart?: number;
  createTimeEnd?: number;
  pageNum: number;
  pageSize: number;
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
  openingBalance?: number | string;
  debitBalance?: number | string;
  creditBalance?: number | string;
  closingBalance?: number | string;
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
  suspenseAssets?: number | string;
  suspenseAssetAmount?: number | string;
  suspenseLiabilities?: number | string;
  suspenseLiabilityAmount?: number | string;
  accountBalances?: EodDetailAccountBalanceItem[];
  suspenseEntries?: unknown[];
  suspenseEntryRows?: unknown[];
  suspenseEntryList?: unknown[];
  [key: string]: unknown;
}

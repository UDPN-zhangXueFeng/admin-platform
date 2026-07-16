/**
 * Suspense Adjustment 数据模型（Frontend Domain Model）。
 *
 * 迁移自 td-manage src/lib/components/financial/adjustments/types.ts。
 * 枚举类型（SourceType / ClearStatus / DrCr / AdjustmentStatus）来自 util 层；
 * 本文件只定义业务 Domain Model + 请求 / 响应类型。页面层只消费这里的 Domain，
 * 不直接绑定后端 DTO 字段（DTO → Domain 映射只在 adapters.ts）。
 *
 * 列表行与历史行注入字符串 `id`（api/mapper 层 = String(主键)）以满足 DataTable
 * `{ id: string }` 契约（与 posting-engine 注入 financeBookId 同思路）。
 */
import type {
  AdjustmentStatus,
  ClearStatus,
  DrCr,
  SourceType,
} from '@myorg/modules/suspense-adjustment/util';

// ── 列表（/list）──────────────────────────────────────────────────────────

/**
 * Suspense Adjustments 列表项。
 * 金额以原始分录金额为基准派生 outstanding。
 */
export interface SuspenseAdjustmentListItem {
  /** DataTable rowKey 契约（= String(suspenseRecordId)）。 */
  id: string;
  /** 暂记记录主键（bookEodSuspenseRecordId），用于跳转详情 / Adjust。 */
  suspenseRecordId: number;
  /** 记账日期，页面展示用字符串（YYYY-MM-DD）。 */
  postingDate: string;
  /** 暂记事务号，按来源加前缀（EOD- / LOC- / RMM-）。 */
  suspenseTxnId: string;
  sourceType: SourceType;
  sourceTypeLabel: string;
  drCr: DrCr;
  /** 科目展示串（code - name）。 */
  accountDisplay: string;
  originalAmount: number;
  totalAdjusted: number;
  outstandingAmount: number;
  currency: string;
  age: number;
  status: ClearStatus;
  statusLabel: string;
  canAdjust: boolean;
  canViewDetails: boolean;
  hasPendingAdjustment: boolean;
}

/** 列表查询条件（Domain，api 层转为后端 VO）。 */
export interface SuspenseAdjustmentListQuery {
  postingDateStart?: string;
  postingDateEnd?: string;
  suspenseTxnId?: string;
  transactionId?: string;
  sourceType?: 'ALL' | SourceType;
  status?: 'ALL' | ClearStatus;
}

/** 列表响应（前端无真实分页，total 取 rows.length）。 */
export interface SuspenseAdjustmentListResponse {
  page: { total: number; pageNum?: number; pageSize?: number };
  rows: SuspenseAdjustmentListItem[];
}

// ── 暂记分录明细行 ──

export interface SuspenseEntryLine {
  postingDate?: string;
  transactionId?: string;
  drCr: DrCr;
  accountCode: string;
  accountName: string;
  accountDisplay: string;
  /** 借方金额（drCr=Dr 时有值）。 */
  debitAmount?: number | null;
  /** 贷方金额（drCr=Cr 时有值）。 */
  creditAmount?: number | null;
  amount: number;
  exceptionContext?: string;
  createdBy?: string;
  createdOn?: string;
}

// ── 调账历史（详情页 Adjustment History 表格）──

export interface SuspenseAdjustmentHistoryItem {
  id: string;
  adjustmentId: number;
  /** 审批任务 ID，跳转 /approval-manage/view?id=taskId。 */
  taskId?: number | string;
  /** 审批业务码，跳转 /approval-manage/view?busCode=xxx。 */
  busCode?: string;
  postingDate: string;
  /** 对方 / 抵账科目展示串。 */
  offsetAccountDisplay: string;
  amount: number;
  adjustmentReason: string;
  createdBy?: string;
  createdOn?: string;
  status: AdjustmentStatus;
  statusLabel: string;
  canViewDetails: boolean;
}

// ── 暂记分录详情（/entry-detail）──

export interface SuspenseAdjustmentDetail {
  suspenseTxnId: string;
  status: ClearStatus;
  statusLabel: string;
  sourceType: SourceType;
  sourceTypeLabel: string;
  age: number;
  financeBookId?: number;
  financeBookName?: string;
  bookId?: string;
  bookNo?: string;
  currency: string;
  originalAmount: number;
  totalAdjusted: number;
  outstandingAmount: number;
  suspenseEntries: SuspenseEntryLine[];
  exceptionContext?: string;
  postingDate?: string;
  transactionId?: string;
  createdBy?: string;
  createdOn?: string;
  adjustmentHistory: SuspenseAdjustmentHistoryItem[];
}

// ── 调账表单（/adjust 请求 + /detail.adjustmentEntries）──

/** New Adjustment Entry 单行表单值。amount 允许 null 兼容受控输入框清空态。 */
export interface NewAdjustmentEntryItem {
  /** 前端生成的行唯一 id（用于增删行 key）。 */
  rowId: string;
  postingDate?: string;
  /** 与 Offsetting Entry for 方向相反的只读方向。 */
  drCr: DrCr;
  accountCode: string;
  accountName: string;
  accountDisplay: string;
  amount: number | null;
  currency: string;
}

/** New Adjustment Entry 表单整体。 */
export interface NewAdjustmentForm {
  suspenseRecordId: number;
  suspenseTxnId: string;
  postingDate: string;
  /** 只读展示，格式 `Dr 1900.99 - Suspense Account - Asset`。 */
  offsettingEntryFor: string;
  entries: NewAdjustmentEntryItem[];
  adjustmentReason: string;
}

/** Adjustment Summary 实时汇总（表单右侧）。 */
export interface AdjustmentSummary {
  thisAdjustment: number;
  remainingAfterThis: number;
  currency: string;
  isFullyCleared: boolean;
}

/** Account 下拉选项（New Adjustment Entry 选科目）。 */
export interface AccountOption {
  accountCode: string;
  accountName: string;
  accountDisplay: string;
  currency: string;
}

// ── 科目下拉（reconciliation tx/accounts/leaf）──

/** 后端 AccountBrief（末级科目简要）。 */
export interface AccountBrief {
  accountCode?: string;
  accountName?: string;
  /** 1=Asset, 2=Liability, 3=Equity, 4=Revenue, 5=Expense。 */
  type?: number;
}

/** accounts/leaf 响应（按借贷分组的末级科目）。 */
export interface LeafAccountsResp {
  debitAccounts?: AccountBrief[];
  creditAccounts?: AccountBrief[];
}

// ── 调账审批详情（/detail，复合 Domain）──

/** /detail 返回的调账详情（含 adjustmentEntries / offsettingEntryFor / 状态汇总）。 */
export interface AdjustedDetailDomain {
  adjustmentId: number;
  applyCode: string;
  thisAdjustment: number;
  remainingAfterThis: number;
  status: AdjustmentStatus;
  statusLabel: string;
  suspenseTxnId: string;
  sourceType: SourceType;
  sourceTypeLabel: string;
  age: number;
  financeBookName?: string;
  bookId?: string;
  bookNo?: string;
  currency: string;
  originalAmount: number;
  outstandingAmount: number;
  /** 后端返回的 offsetting 文案，原样透传到表单只读展示。 */
  offsettingEntryFor: string;
  transactionId?: string;
  adjustmentReason?: string;
  createdBy?: string;
  createdOn?: string;
  suspenseEntries: SuspenseEntryLine[];
  adjustmentEntries: NewAdjustmentEntryItem[];
}

/** Submit 成功响应（applyCode / adjustmentId / status）。 */
export interface AdjustmentSubmitResult {
  applyCode: string;
  adjustmentId: number;
  status: AdjustmentStatus;
}

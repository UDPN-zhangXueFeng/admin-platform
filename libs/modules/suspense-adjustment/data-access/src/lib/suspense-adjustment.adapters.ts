/**
 * Suspense Adjustment 后端 DTO → 前端 Domain Model 映射（adapters）。
 *
 * 迁移自 td-manage src/lib/components/financial/adjustments/adapters.ts。
 *
 * 职责边界：
 * - 唯一对接后端 DTO 的位置；页面只消费这里的 Domain 输出。
 * - epoch millis ↔ 日期字符串、枚举数值 ↔ Domain、account 串 → accountDisplay 均在此完成。
 * - canAdjust / canViewDetails / hasPendingAdjustment 等派生逻辑在此计算。
 * - 列表行 / 历史行注入 `id`（String(主键)）满足 DataTable `{ id: string }` 契约。
 *
 * 不做：请求发起（在 api.ts）、副作用、toast。
 */
import type {
  AdjustmentStatus,
  ClearStatus,
  DrCr,
  SourceType,
} from '@myorg/modules/suspense-adjustment/util';
import {
  ADJUSTMENT_STATUS_MAP,
  CLEAR_STATUS_MAP,
  SOURCE_TYPE_MAP,
} from '@myorg/modules/suspense-adjustment/util';
import {
  epochToDateString,
  formatCreatedOnDateTime,
  mapAdjustmentStatus,
  mapClearStatus,
  mapSourceType,
} from '@myorg/modules/suspense-adjustment/util';
import type {
  AdjustedDetailDomain,
  AdjustmentSubmitResult,
  NewAdjustmentEntryItem,
  SuspenseAdjustmentDetail,
  SuspenseAdjustmentHistoryItem,
  SuspenseAdjustmentListItem,
  SuspenseEntryLine,
} from './suspense-adjustment.model';

/* ------------------------------------------------------------------ */
/* 后端 DTO 类型（仅描述本模块消费的字段，未消费字段不声明，避免误导） */
/* ------------------------------------------------------------------ */

/** 后端 /list 单行 VO（SuspenseAdjustListRespVO）。 */
export interface SuspenseAdjustListRespVO {
  bookEodSuspenseRecordId: number;
  postingDate: number;
  suspenseTxnId: string;
  sourceType: number;
  drCr: string;
  /** '科目编码 - 科目名称'。 */
  account: string;
  originalAmount: number | string;
  totalAdjusted: number | string;
  outstandingAmount: number | string;
  age: number;
  /** 文本：Outstanding / Partially Cleared / Cleared。 */
  status: string;
}

/** 后端 suspenseEntries[]（SuspenseEntryVO），list / entry-detail / detail 共用。 */
export interface SuspenseEntryVO {
  drCr: string;
  accountCode: string;
  accountName: string;
  amount: number | string;
  postingDate?: number;
  transactionId?: string;
  exceptionContext?: string;
  createdBy?: string;
  createdOn?: number;
}

/** 后端 adjustmentHistory[]（AdjustmentHistoryItem）。 */
export interface AdjustmentHistoryItemVO {
  adjustmentId?: number;
  taskId?: number | string;
  workflowTaskId?: number | string;
  busCode?: string;
  businessCode?: string;
  postingDate?: number;
  /** 对方科目 '编码 - 名称'。 */
  creditAccount?: string;
  amount: number | string;
  transactionId?: string;
  adjustmentReason?: string;
  createdBy?: string;
  createdOn?: number;
  /** 数值状态：5/10/15/20/3。 */
  status: number;
}

/** 后端 /entry-detail 顶层 VO（SuspenseEntryDetailRespVO）。 */
export interface SuspenseEntryDetailRespVO {
  suspenseTxnId: string;
  status: string;
  sourceType: number;
  age: number;
  financeBookId?: number;
  financeBookName?: string;
  bookId?: string;
  bookNo?: string;
  currency: string;
  originalAmount: number | string;
  totalAdjusted: number | string;
  outstandingAmount: number | string;
  suspenseEntries: SuspenseEntryVO[];
  exceptionContext?: string;
  postingDate?: number;
  transactionId?: string;
  createdBy?: string;
  createdOn?: number;
  adjustmentHistory: AdjustmentHistoryItemVO[];
}

/** 后端 /adjust 响应 VO（SuspenseAdjustRespVO）。 */
export interface SuspenseAdjustRespVO {
  applyCode: string;
  adjustmentId: number;
  /** 数值状态：5=待审核。 */
  status: number;
}

/** 后端 /detail 的 adjustmentEntries[]（AdjustmentEntryItem）。 */
export interface AdjustmentEntryItemVO {
  postingDate?: number;
  drCr?: string;
  accountCode: string;
  accountName: string;
  amount: number | string;
}

/** 后端 /detail 顶层 VO（SuspenseAdjustmentApprovalDetailVO）。 */
export interface SuspenseAdjustmentApprovalDetailVO {
  adjustmentId: number;
  applyCode: string;
  adjustmentAmount?: number | string;
  status: number;
  createdBy?: string;
  createdOn?: number;
  suspenseTxnId: string;
  sourceType: number;
  age: number;
  financeBookName?: string;
  bookId?: string;
  bookNo?: string;
  currency: string;
  originalAmount: number | string;
  outstandingAmount: number | string;
  suspenseEntries: SuspenseEntryVO[];
  offsettingEntryFor: string;
  transactionId?: string;
  adjustmentEntries: AdjustmentEntryItemVO[];
  thisAdjustment?: number | string;
  remainingAfter?: number | string;
  adjustmentReason?: string;
}

/* ------------------------------------------------------------------ */
/* 共享派生逻辑                                                        */
/* ------------------------------------------------------------------ */

/** drCr 字符串归一：'Dr'/'Cr'，非法默认 'Dr'（与 mock 主路径一致）。 */
const normalizeDrCr = (raw: string | undefined): DrCr =>
  raw?.trim().toLowerCase() === 'cr' ? 'Cr' : 'Dr';

const toNumber = (value: number | string | null | undefined): number => {
  if (value == null || value === '') return 0;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

/**
 * 是否存在待审批 / 审批中的调账（驱动 Adjust 置灰）。
 * PENDING_REVIEW / IN_PROCESS_REVIEW 视为 pending。
 */
export const hasPendingAdjustmentFromHistory = (
  history: AdjustmentHistoryItemVO[],
): boolean =>
  history.some((h) => {
    const s = mapAdjustmentStatus(h.status);
    return s === 'PENDING_REVIEW' || s === 'IN_PROCESS_REVIEW';
  });

/**
 * 派生可调账 / 可查看 / pending 标志（列表与详情共用）。
 * canAdjust = 未清账 && 无 pending；canViewDetails 恒为 true。
 */
const deriveListFlags = (
  status: ClearStatus,
  hasPending: boolean,
): Pick<
  SuspenseAdjustmentListItem,
  'canAdjust' | 'canViewDetails' | 'hasPendingAdjustment'
> => ({
  canAdjust: status !== 'CLEARED' && !hasPending,
  canViewDetails: true,
  hasPendingAdjustment: hasPending,
});

/* ------------------------------------------------------------------ */
/* Mapper 函数                                                         */
/* ------------------------------------------------------------------ */

/**
 * /list 单行 DTO → 列表 Domain。
 * 注入 id = String(bookEodSuspenseRecordId) 满足 DataTable 契约。
 */
export const adaptSuspenseAdjustmentListItem = (
  vo: SuspenseAdjustListRespVO,
): SuspenseAdjustmentListItem => {
  const sourceType: SourceType = mapSourceType(vo.sourceType) ?? 'EOD';
  const status: ClearStatus = mapClearStatus(vo.status) ?? 'OUTSTANDING';
  const original = toNumber(vo.originalAmount);
  const adjusted = toNumber(vo.totalAdjusted);
  const outstanding =
    vo.outstandingAmount != null
      ? toNumber(vo.outstandingAmount)
      : Math.max(0, original - adjusted);
  // 列表 DTO 不含 history，无法从数据派生 pending，保守按 false；
  // 真实 pending 由 entry-detail 返回的 history 承载（见 adaptSuspenseEntryDetail）。
  const flags = deriveListFlags(status, false);
  return {
    id: String(vo.bookEodSuspenseRecordId),
    suspenseRecordId: vo.bookEodSuspenseRecordId,
    postingDate: epochToDateString(vo.postingDate) ?? '',
    suspenseTxnId: vo.suspenseTxnId,
    sourceType,
    sourceTypeLabel: SOURCE_TYPE_MAP[sourceType].label,
    drCr: normalizeDrCr(vo.drCr),
    accountDisplay: vo.account,
    originalAmount: original,
    totalAdjusted: adjusted,
    outstandingAmount: outstanding,
    currency: '', // 列表 DTO 无币种字段，由详情回填或页面占位
    age: vo.age ?? 0,
    status,
    statusLabel: CLEAR_STATUS_MAP[status].label,
    ...flags,
  };
};

/** suspenseEntries[] VO → Domain（补齐 debitAmount/creditAmount 与 accountDisplay）。 */
const adaptSuspenseEntry = (vo: SuspenseEntryVO): SuspenseEntryLine => {
  const drCr = normalizeDrCr(vo.drCr);
  const amount = toNumber(vo.amount);
  return {
    postingDate: epochToDateString(vo.postingDate),
    transactionId: vo.transactionId,
    drCr,
    accountCode: vo.accountCode,
    accountName: vo.accountName,
    accountDisplay: `${vo.accountCode} - ${vo.accountName}`,
    debitAmount: drCr === 'Dr' ? amount : null,
    creditAmount: drCr === 'Cr' ? amount : null,
    amount,
    exceptionContext: vo.exceptionContext,
    createdBy: vo.createdBy,
    createdOn: formatCreatedOnDateTime(vo.createdOn),
  };
};

/** adjustmentHistory[] VO → Domain（creditAccount → offsetAccountDisplay，注入 id）。 */
const adaptAdjustmentHistory = (
  vo: AdjustmentHistoryItemVO,
): SuspenseAdjustmentHistoryItem => {
  const status: AdjustmentStatus =
    mapAdjustmentStatus(vo.status) ?? 'PENDING_REVIEW';
  return {
    id: String(vo.adjustmentId ?? 0),
    adjustmentId: vo.adjustmentId ?? 0,
    taskId: vo.taskId ?? vo.workflowTaskId,
    busCode: vo.busCode ?? vo.businessCode,
    postingDate: epochToDateString(vo.postingDate) ?? '',
    offsetAccountDisplay: vo.creditAccount ?? '',
    amount: toNumber(vo.amount),
    adjustmentReason: vo.adjustmentReason ?? '',
    createdBy: vo.createdBy,
    createdOn: formatCreatedOnDateTime(vo.createdOn),
    status,
    statusLabel: ADJUSTMENT_STATUS_MAP[status].label,
    canViewDetails: true,
  };
};

/** /entry-detail DTO → 详情 Domain。 */
export const adaptSuspenseEntryDetail = (
  vo: SuspenseEntryDetailRespVO,
): SuspenseAdjustmentDetail => {
  const sourceType: SourceType = mapSourceType(vo.sourceType) ?? 'EOD';
  const status: ClearStatus = mapClearStatus(vo.status) ?? 'OUTSTANDING';
  return {
    suspenseTxnId: vo.suspenseTxnId,
    status,
    statusLabel: CLEAR_STATUS_MAP[status].label,
    sourceType,
    sourceTypeLabel: SOURCE_TYPE_MAP[sourceType].label,
    age: vo.age ?? 0,
    financeBookId: vo.financeBookId,
    financeBookName: vo.financeBookName,
    bookId: vo.bookId,
    bookNo: vo.bookNo,
    currency: vo.currency,
    originalAmount: toNumber(vo.originalAmount),
    totalAdjusted: toNumber(vo.totalAdjusted),
    outstandingAmount: toNumber(vo.outstandingAmount),
    suspenseEntries: (vo.suspenseEntries ?? []).map(adaptSuspenseEntry),
    exceptionContext: vo.exceptionContext,
    postingDate: epochToDateString(vo.postingDate),
    transactionId: vo.transactionId,
    createdBy: vo.createdBy,
    createdOn: formatCreatedOnDateTime(vo.createdOn),
    adjustmentHistory: (vo.adjustmentHistory ?? []).map(adaptAdjustmentHistory),
  };
};

/** /adjust 响应 VO → 提交结果 Domain。 */
export const adaptAdjustSubmitResult = (
  vo: SuspenseAdjustRespVO,
): AdjustmentSubmitResult => ({
  applyCode: vo.applyCode,
  adjustmentId: vo.adjustmentId,
  status: mapAdjustmentStatus(vo.status) ?? 'PENDING_REVIEW',
});

/**
 * /detail 的 adjustmentEntries[] → 表单 NewAdjustmentEntryItem[]。
 * rowId 由前端生成（crypto.randomUUID，降级 Math.random）；currency 由调用方注入。
 */
const adaptAdjustmentEntryItem = (
  vo: AdjustmentEntryItemVO,
): NewAdjustmentEntryItem => ({
  rowId:
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  postingDate: epochToDateString(vo.postingDate),
  drCr: normalizeDrCr(vo.drCr),
  accountCode: vo.accountCode,
  accountName: vo.accountName,
  accountDisplay: `${vo.accountCode} - ${vo.accountName}`,
  amount: toNumber(vo.amount),
  currency: '', // currency 不在 adjustmentEntries 内，由调用方从顶层 currency 注入
});

/**
 * /detail DTO → 调账详情 Domain。
 * adjustmentEntries 映射为 NewAdjustmentEntryItem[]，并注入顶层 currency。
 */
export const adaptSuspenseAdjustmentDetail = (
  vo: SuspenseAdjustmentApprovalDetailVO,
): AdjustedDetailDomain => {
  const sourceType: SourceType = mapSourceType(vo.sourceType) ?? 'EOD';
  const status: AdjustmentStatus =
    mapAdjustmentStatus(vo.status) ?? 'PENDING_REVIEW';
  const currency = vo.currency;
  return {
    adjustmentId: vo.adjustmentId,
    applyCode: vo.applyCode,
    thisAdjustment: toNumber(vo.thisAdjustment ?? vo.adjustmentAmount),
    remainingAfterThis: toNumber(vo.remainingAfter),
    status,
    statusLabel: ADJUSTMENT_STATUS_MAP[status].label,
    suspenseTxnId: vo.suspenseTxnId,
    sourceType,
    sourceTypeLabel: SOURCE_TYPE_MAP[sourceType].label,
    age: vo.age ?? 0,
    financeBookName: vo.financeBookName,
    bookId: vo.bookId,
    bookNo: vo.bookNo,
    currency,
    originalAmount: toNumber(vo.originalAmount),
    outstandingAmount: toNumber(vo.outstandingAmount),
    offsettingEntryFor: vo.offsettingEntryFor,
    transactionId: vo.transactionId,
    adjustmentReason: vo.adjustmentReason,
    createdBy: vo.createdBy,
    createdOn: formatCreatedOnDateTime(vo.createdOn),
    suspenseEntries: (vo.suspenseEntries ?? []).map(adaptSuspenseEntry),
    adjustmentEntries: (vo.adjustmentEntries ?? []).map((e) => ({
      ...adaptAdjustmentEntryItem(e),
      currency,
    })),
  };
};

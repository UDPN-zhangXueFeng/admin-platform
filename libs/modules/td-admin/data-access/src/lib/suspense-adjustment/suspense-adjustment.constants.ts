/**
 * Suspense Adjustment 枚举常量与展示映射（统一收口）。
 *
 * 迁移自 td-manage src/lib/components/financial/adjustments/constants.ts。
 * 所有来源类型、清账状态、审批状态的「枚举值 → 展示文案 / 标签色值」集中在此，
 * 组件不得各自维护 if/else 副本。
 *
 * 层级：util 是底层，只定义枚举与映射；业务 Domain Model（列表项 / 详情 /
 * 表单）在 data-access/model.ts，import 本文件的枚举类型。
 */

/** 来源异常类型。1=EOD, 2=LOC, 3=RMM。 */
export type SourceType = 'EOD' | 'LOC' | 'RMM';

/** 列表查询 Source Type，包含 ALL 默认项。 */
export type SourceTypeFilter = 'ALL' | SourceType;

/** 暂记分录清账状态（页面级三态）。 */
export type ClearStatus = 'OUTSTANDING' | 'PARTIALLY_CLEARED' | 'CLEARED';

/** 列表查询 Status，包含 ALL 默认项。 */
export type ClearStatusFilter = 'ALL' | ClearStatus;

/** 借贷方向。1=Dr, 2=Cr。 */
export type DrCr = 'Dr' | 'Cr';

/** 调账审批状态（Adjustment History 共用）。5/10/15/20/3。 */
export type AdjustmentStatus =
  | 'PENDING_REVIEW'
  | 'IN_PROCESS_REVIEW'
  | 'REJECTED'
  | 'APPROVED'
  | 'WITHDRAWN';

/**
 * 标签色值 token（语义色名）。
 * ui 层（badge/status-tag）把 color 映射到 Tailwind badge class，
 * constants 不绑死具体类名，保持源设计。
 */
export interface StatusTone {
  color: string;
  label: string;
}

/** 后端 sourceType 原始数值 → Domain 枚举（adapter 层使用）。 */
export const SOURCE_TYPE_CODE_MAP: Record<number, SourceType> = {
  1: 'EOD',
  2: 'LOC',
  3: 'RMM',
};

/**
 * 清账状态原始数值 → Domain 枚举（adapter 层使用）。
 * 编码按列表查询参数 clearStatus 约定：1=Outstanding, 2=Partially, 3=Cleared。
 */
export const CLEAR_STATUS_CODE_MAP: Record<number, ClearStatus> = {
  1: 'OUTSTANDING',
  2: 'PARTIALLY_CLEARED',
  3: 'CLEARED',
};

/** Domain 清账状态 → 列表查询 clearStatus 数值（构造列表请求时使用）。 */
export const CLEAR_STATUS_ENUM_TO_CODE: Record<ClearStatus, number> = {
  OUTSTANDING: 1,
  PARTIALLY_CLEARED: 2,
  CLEARED: 3,
};

/** Domain 来源类型 → 列表查询 sourceType 数值（构造列表请求时使用）。 */
export const SOURCE_TYPE_ENUM_TO_CODE: Record<SourceType, number> = {
  EOD: 1,
  LOC: 2,
  RMM: 3,
};

/** 后端审批状态原始数值 → Domain 枚举（adapter 层使用）。 */
export const ADJUSTMENT_STATUS_CODE_MAP: Record<number, AdjustmentStatus> = {
  5: 'PENDING_REVIEW',
  10: 'IN_PROCESS_REVIEW',
  15: 'REJECTED',
  20: 'APPROVED',
  3: 'WITHDRAWN',
};

/**
 * Source Type 展示映射：枚举 → label + Suspense Txn ID 前缀。
 * - EOD → 'EOD Reconciliation'，前缀 'EOD-'
 * - LOC → 'Ledger vs On-chain'，前缀 'LOC-'
 * - RMM → 'RMM'，前缀 'RMM-'
 */
export const SOURCE_TYPE_MAP: Record<
  SourceType,
  { label: string; txnIdPrefix: string }
> = {
  EOD: { label: 'EOD Reconciliation', txnIdPrefix: 'EOD-' },
  LOC: { label: 'Ledger vs On-chain', txnIdPrefix: 'LOC-' },
  RMM: { label: 'RMM', txnIdPrefix: 'RMM-' },
};

/** Source Type 下拉选项（含 ALL，用于列表页 Query 区）。源仅列 ALL/EOD/LOC。 */
export const SOURCE_TYPE_OPTIONS: Array<{
  label: string;
  value: 'ALL' | SourceType;
}> = [
  { label: 'All', value: 'ALL' },
  { label: SOURCE_TYPE_MAP.EOD.label, value: 'EOD' },
  { label: SOURCE_TYPE_MAP.LOC.label, value: 'LOC' },
];

/** Clear Status / 页面状态展示映射：枚举 → label + 标签色值。 */
export const CLEAR_STATUS_MAP: Record<ClearStatus, StatusTone> = {
  OUTSTANDING: { color: 'red', label: 'Outstanding' },
  PARTIALLY_CLEARED: { color: 'orange', label: 'Partially Cleared' },
  CLEARED: { color: 'green', label: 'Cleared' },
};

/** Clear Status 下拉选项（含 ALL，用于列表页 Query 区）。 */
export const CLEAR_STATUS_OPTIONS: Array<{
  label: string;
  value: 'ALL' | ClearStatus;
}> = [
  { label: 'All', value: 'ALL' },
  { label: CLEAR_STATUS_MAP.OUTSTANDING.label, value: 'OUTSTANDING' },
  {
    label: CLEAR_STATUS_MAP.PARTIALLY_CLEARED.label,
    value: 'PARTIALLY_CLEARED',
  },
  { label: CLEAR_STATUS_MAP.CLEARED.label, value: 'CLEARED' },
];

/** 页面 label → 清账状态枚举（mapClearStatus 反查文本用）。 */
export const CLEAR_STATUS_LABEL_TO_ENUM: Record<string, ClearStatus> = {
  Outstanding: 'OUTSTANDING',
  'Partially Cleared': 'PARTIALLY_CLEARED',
  Cleared: 'CLEARED',
};

/** Adjustment 审批状态展示映射。 */
export const ADJUSTMENT_STATUS_MAP: Record<AdjustmentStatus, StatusTone> = {
  PENDING_REVIEW: { color: 'gold', label: 'Pending Review' },
  IN_PROCESS_REVIEW: { color: 'blue', label: 'In Process Review' },
  REJECTED: { color: 'red', label: 'Rejected' },
  APPROVED: { color: 'green', label: 'Approved' },
  WITHDRAWN: { color: 'default', label: 'Withdrawn' },
};

/** Age 账龄色值档位 token（ui 层映射到 Tailwind badge class）。 */
export const AGE_TAG_TONES = {
  NORMAL: 'default',
  WARN: 'orange',
  DANGER: 'red',
} as const;

/** Age 阈值（天）。 */
export const AGE_WARN_THRESHOLD = 4;
export const AGE_DANGER_THRESHOLD = 8;

/** Adjustment Reason 字符上限（多行文本字符计数）。 */
export const ADJUSTMENT_REASON_MAX_LENGTH = 1000;

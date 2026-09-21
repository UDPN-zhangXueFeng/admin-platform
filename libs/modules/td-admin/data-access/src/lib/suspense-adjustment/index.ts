// Suspense Adjustment util barrel.
// 枚举类型 + 常量映射 + 纯函数（不依赖业务 Domain；Domain 转换在 data-access）。

// ── 枚举类型 ──
export type {
  SourceType,
  SourceTypeFilter,
  ClearStatus,
  ClearStatusFilter,
  DrCr,
  AdjustmentStatus,
  StatusTone,
} from './suspense-adjustment.constants';

// ── 常量与映射 ──
export {
  SOURCE_TYPE_CODE_MAP,
  CLEAR_STATUS_CODE_MAP,
  CLEAR_STATUS_ENUM_TO_CODE,
  SOURCE_TYPE_ENUM_TO_CODE,
  ADJUSTMENT_STATUS_CODE_MAP,
  SOURCE_TYPE_MAP,
  SOURCE_TYPE_OPTIONS,
  CLEAR_STATUS_MAP,
  CLEAR_STATUS_OPTIONS,
  CLEAR_STATUS_LABEL_TO_ENUM,
  ADJUSTMENT_STATUS_MAP,
  AGE_TAG_TONES,
  AGE_WARN_THRESHOLD,
  AGE_DANGER_THRESHOLD,
  ADJUSTMENT_REASON_MAX_LENGTH,
} from './suspense-adjustment.constants';

// ── 纯函数 ──
export {
  formatAmount,
  textOrDash,
  mapSourceType,
  mapAdjustmentStatus,
  mapClearStatus,
  getAgeTagTone,
  calculateThisAdjustment,
  calculateRemainingAfter,
  getDefaultPostingDate,
  epochToDateString,
  formatCreatedOnDateTime,
  dateStringToEpoch,
  getOffsettingDirection,
} from './suspense-adjustment.helpers';
// Suspense Adjustment data-access barrel.

// ── model（业务 Domain + 请求/响应类型）──
export type {
  SuspenseAdjustmentListItem,
  SuspenseAdjustmentListQuery,
  SuspenseAdjustmentListResponse,
  SuspenseEntryLine,
  SuspenseAdjustmentHistoryItem,
  SuspenseAdjustmentDetail,
  NewAdjustmentEntryItem,
  NewAdjustmentForm,
  AdjustmentSummary,
  AccountOption,
  AccountBrief,
  LeafAccountsResp,
  AdjustedDetailDomain,
  AdjustmentSubmitResult,
} from './suspense-adjustment.model';

// ── api（5 endpoint）──
export {
  getSuspenseAdjustmentList,
  getSuspenseEntryDetail,
  submitSuspenseAdjustment,
  getSuspenseAdjustmentDetail,
  getTxAccountsLeaf,
} from './suspense-adjustment.api';

// ── queries（TanStack Query hooks）──
export {
  suspenseAdjustmentKeys,
} from './+queries/suspense-adjustment.keys';
export {
  useSuspenseAdjustmentListQuery,
  useSuspenseEntryDetailQuery,
  useSuspenseAdjustmentDetailQuery,
  useTxAccountsLeafQuery,
  useSubmitSuspenseAdjustmentMutation,
} from './+queries/suspense-adjustment.queries';

// ── utils（依赖 Domain 的转换）──
export {
  buildAdjustPayload,
  getSuspenseAccountLine,
  getOffsettingEntryFor,
} from './suspense-adjustment.utils';
export type {
  AdjustPayload,
} from './suspense-adjustment.utils';

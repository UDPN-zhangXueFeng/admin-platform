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
} from './lib/suspense-adjustment.model';

// ── api（5 endpoint）──
export {
  getSuspenseAdjustmentList,
  getSuspenseEntryDetail,
  submitSuspenseAdjustment,
  getSuspenseAdjustmentDetail,
  getTxAccountsLeaf,
} from './lib/suspense-adjustment.api';

// ── queries（TanStack Query hooks）──
export { suspenseAdjustmentKeys } from './lib/+queries/suspense-adjustment.keys';
export {
  useSuspenseAdjustmentListQuery,
  useSuspenseEntryDetailQuery,
  useSuspenseAdjustmentDetailQuery,
  useTxAccountsLeafQuery,
  useSubmitSuspenseAdjustmentMutation,
} from './lib/+queries/suspense-adjustment.queries';

// ── utils（依赖 Domain 的转换）──
export {
  buildAdjustPayload,
  getSuspenseAccountLine,
  getOffsettingEntryFor,
} from './lib/suspense-adjustment.utils';
export type { AdjustPayload } from './lib/suspense-adjustment.utils';

// mmf data-access barrel.

// ── model ──
export type {
  ResultPageInfo,
  FundOption,
  AccrualRecordItem,
  AccrualListFilters,
  AccrualListParams,
  AccrualListResponse,
  AccrualDetail,
  AccrualWalletRecord,
  AccrualWalletListFilters,
  AccrualWalletListParams,
  SettlementRecordItem,
  SettlementListFilters,
  SettlementListParams,
  SettlementListResponse,
  SettlementDetail,
  SettlementWalletRecord,
  SettlementWalletListFilters,
  SettlementWalletListParams,
  SettlementApprovalRecord,
  SettlementApprovalListFilters,
  SettlementApprovalListParams,
  BatchApplyListItem,
  BatchApplyListParams,
  ApplyReqVO,
  AccrualApplyReqVO,
  SingleApplyPreviewItem,
  StablecoinSearchOption,
  BlockchainOption,
} from './lib/mmf.model';

// ── api（12 endpoint）──
export {
  getAccrualRecordList,
  getSettlementRecordList,
  getAccrualDetail,
  getSettlementDetail,
  getAccrualWalletRecords,
  getSettlementWalletRecords,
  getSettlementApprovalRecords,
  getFundList,
  getBatchApplyList,
  applyAccrualRecord,
  getStablecoinSearches,
  getBlockchainList,
} from './lib/mmf.api';

// ── query keys ──
export { mmfKeys } from './lib/+queries/mmf.keys';

// ── queries ──
export {
  useAccrualRecordListQuery,
  useSettlementRecordListQuery,
  useAccrualDetailQuery,
  useSettlementDetailQuery,
  useAccrualWalletRecordsQuery,
  useSettlementWalletRecordsQuery,
  useSettlementApprovalRecordsQuery,
  useFundListQuery,
  useBatchApplyListQuery,
  useStablecoinSearchesQuery,
  useBlockchainListQuery,
  // mutations（同时从 queries.ts 导出，维持单文件导入便利）
  useApplyAccrualMutation,
  useBatchApplyListMutation,
} from './lib/+queries/mmf.queries';

// ── mutations（独立入口，显式拆分）──
export { useApplyAccrualMutation as useApplyAccrualMutationFromMutations } from './lib/+queries/mmf.mutations';

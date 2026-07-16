import type {
  AccrualListParams,
  AccrualWalletListParams,
  BatchApplyListParams,
  SettlementApprovalListParams,
  SettlementListParams,
  SettlementWalletListParams,
} from '../mmf.model';

/** TanStack Query key 工厂。 */
export const mmfKeys = {
  all: ['mmf'] as const,

  // ── 计提 ──
  accrual: () => [...mmfKeys.all, 'accrual'] as const,
  accrualList: (params: AccrualListParams) =>
    [...mmfKeys.accrual(), 'list', params] as const,
  accrualDetail: (accrualRecordId: number | string) =>
    [...mmfKeys.accrual(), 'detail', accrualRecordId] as const,
  accrualWalletRecords: (params: AccrualWalletListParams) =>
    [...mmfKeys.accrual(), 'wallet-records', params] as const,
  batchApplyList: (params: BatchApplyListParams) =>
    [...mmfKeys.accrual(), 'batch-apply-list', params] as const,

  // ── 结算 ──
  settlement: () => [...mmfKeys.all, 'settlement'] as const,
  settlementList: (params: SettlementListParams) =>
    [...mmfKeys.settlement(), 'list', params] as const,
  settlementDetail: (settlementId: number | string) =>
    [...mmfKeys.settlement(), 'detail', settlementId] as const,
  settlementWalletRecords: (params: SettlementWalletListParams) =>
    [...mmfKeys.settlement(), 'wallet-records', params] as const,
  settlementApprovalRecords: (params: SettlementApprovalListParams) =>
    [...mmfKeys.settlement(), 'approval-records', params] as const,

  // ── 公共下拉 ──
  fundList: () => [...mmfKeys.all, 'fund-list'] as const,
  stablecoinSearches: () => [...mmfKeys.all, 'stablecoin-searches'] as const,
  blockchainList: () => [...mmfKeys.all, 'blockchain-list'] as const,
} as const;

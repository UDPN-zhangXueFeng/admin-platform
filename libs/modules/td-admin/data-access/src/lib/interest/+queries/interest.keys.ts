/**
 * Interest 模块 TanStack Query key 工厂。
 */
import type {
  AccrualHistoryListFilters,
  AccrualRecordListFilters,
  InterestRuleListFilters,
  PolicyOperationListFilters,
  TokenBillListFilters,
  TransactionOperationListFilters,
  TransactionRecordListFilters,
} from '../interest.model';

export const interestKeys = {
  all: ['interest'] as const,

  // 公共下拉
  stablecoinOptions: () => [...interestKeys.all, 'stablecoin-options'] as const,
  blockchainOptions: () => [...interestKeys.all, 'blockchain-options'] as const,

  // Policy
  policyList: (filters: InterestRuleListFilters) =>
    [...interestKeys.all, 'policy-list', filters] as const,
  policyDetail: (interestRuleId: number) =>
    [...interestKeys.all, 'policy-detail', interestRuleId] as const,
  policyOperationRecords: (filters: PolicyOperationListFilters) =>
    [...interestKeys.all, 'policy-operation-records', filters] as const,

  // Accrual
  accrualList: (filters: AccrualRecordListFilters) =>
    [...interestKeys.all, 'accrual-list', filters] as const,
  accrualDetail: (accrualRecordId: number) =>
    [...interestKeys.all, 'accrual-detail', accrualRecordId] as const,
  accrualHistoryList: (filters: AccrualHistoryListFilters) =>
    [...interestKeys.all, 'accrual-history-list', filters] as const,

  // Transactions
  tokenBillList: (filters: TokenBillListFilters) =>
    [...interestKeys.all, 'tx-list', filters] as const,
  tokenBillDetail: (tokenBillId: number) =>
    [...interestKeys.all, 'tx-detail', tokenBillId] as const,
  transactionRecords: (filters: TransactionRecordListFilters) =>
    [...interestKeys.all, 'tx-detail-records', filters] as const,
  transactionOperationRecords: (filters: TransactionOperationListFilters) =>
    [...interestKeys.all, 'tx-operation-records', filters] as const,
};

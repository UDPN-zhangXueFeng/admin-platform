/**
 * Interest 模块 TanStack Query key 工厂。
 */
export const interestKeys = {
  all: ['interest'] as const,

  // 公共下拉
  stablecoinOptions: () => [...interestKeys.all, 'stablecoin-options'] as const,
  blockchainOptions: () => [...interestKeys.all, 'blockchain-options'] as const,

  // Policy
  policyList: (filters: Record<string, unknown>) =>
    [...interestKeys.all, 'policy-list', filters] as const,
  policyDetail: (interestRuleId: number) =>
    [...interestKeys.all, 'policy-detail', interestRuleId] as const,
  policyOperationRecords: (filters: Record<string, unknown>) =>
    [...interestKeys.all, 'policy-operation-records', filters] as const,

  // Accrual
  accrualList: (filters: Record<string, unknown>) =>
    [...interestKeys.all, 'accrual-list', filters] as const,
  accrualDetail: (accrualRecordId: number) =>
    [...interestKeys.all, 'accrual-detail', accrualRecordId] as const,
  accrualHistoryList: (filters: Record<string, unknown>) =>
    [...interestKeys.all, 'accrual-history-list', filters] as const,

  // Transactions
  tokenBillList: (filters: Record<string, unknown>) =>
    [...interestKeys.all, 'tx-list', filters] as const,
  tokenBillDetail: (tokenBillId: number) =>
    [...interestKeys.all, 'tx-detail', tokenBillId] as const,
  transactionRecords: (filters: Record<string, unknown>) =>
    [...interestKeys.all, 'tx-detail-records', filters] as const,
  transactionOperationRecords: (filters: Record<string, unknown>) =>
    [...interestKeys.all, 'tx-operation-records', filters] as const,
};

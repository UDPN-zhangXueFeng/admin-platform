import type { SpAccessListParams } from './sp-access.model';

export const spAccessKeys = {
  all: ['sp-access'] as const,
  lists: () => [...spAccessKeys.all, 'list'] as const,
  list: (params: SpAccessListParams) => [...spAccessKeys.lists(), params] as const,
  details: () => [...spAccessKeys.all, 'detail'] as const,
  detail: (spId?: number) => [...spAccessKeys.details(), spId] as const,
  operationRecords: (spCode?: string) => [...spAccessKeys.all, 'operation-records', spCode] as const,
  userWallets: (params: { spCode?: string; pageNum: number; pageSize: number }) =>
    [...spAccessKeys.all, 'user-wallets', params] as const,
  submittedTransactions: (params: { spCode?: string; pageNum: number; pageSize: number }) =>
    [...spAccessKeys.all, 'submitted-transactions', params] as const,
  walletRules: () => [...spAccessKeys.all, 'wallet-rules'] as const,
  typeOptions: () => [...spAccessKeys.all, 'type-options'] as const,
  stablecoinOptions: () => [...spAccessKeys.all, 'stablecoin-options'] as const,
};

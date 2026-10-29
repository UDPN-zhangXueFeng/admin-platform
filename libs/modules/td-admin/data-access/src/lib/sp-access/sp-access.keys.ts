import type {
  SpAccessListParams,
  SpAccessOperationRecordListParams,
  SpAccessSftpBase64Params,
  SpAccessSubmittedTransactionListParams,
  SpAccessUserWalletListParams,
} from './sp-access.model';

export const spAccessKeys = {
  all: ['sp-access'] as const,
  lists: () => [...spAccessKeys.all, 'list'] as const,
  list: (params: SpAccessListParams) => [...spAccessKeys.lists(), params] as const,
  details: () => [...spAccessKeys.all, 'detail'] as const,
  detail: (spId?: number) => [...spAccessKeys.details(), spId] as const,
  approvalDetail: (spRecordId?: number) =>
    [...spAccessKeys.details(), 'approval', spRecordId] as const,
  operationRecords: (params: SpAccessOperationRecordListParams) =>
    [...spAccessKeys.all, 'operation-records', params] as const,
  userWallets: (params: SpAccessUserWalletListParams) =>
    [...spAccessKeys.all, 'user-wallets', params] as const,
  submittedTransactions: (params: SpAccessSubmittedTransactionListParams) =>
    [...spAccessKeys.all, 'submitted-transactions', params] as const,
  walletRules: () => [...spAccessKeys.all, 'wallet-rules'] as const,
  typeOptions: () => [...spAccessKeys.all, 'type-options'] as const,
  stablecoinOptions: () => [...spAccessKeys.all, 'stablecoin-options'] as const,
  sftpBase64: (params: SpAccessSftpBase64Params) =>
    [...spAccessKeys.all, 'sftp-base64', params] as const,
};

import { useQuery } from '@tanstack/react-query';
import {
  getSpAccessDetail,
  getSpAccessList,
  getSpAccessOperationRecords,
  getSpAccessStablecoinOptions,
  getSpAccessSubmittedTransactions,
  getSpAccessTypeOptions,
  getSpAccessUserWallets,
  getSpAccessWalletRules,
} from './sp-access.api';
import { spAccessKeys } from './sp-access.keys';
import type { SpAccessDetailListParams, SpAccessListParams } from './sp-access.model';

export function useSpAccessListQuery(params: SpAccessListParams) {
  return useQuery({
    queryKey: spAccessKeys.list(params),
    queryFn: () => getSpAccessList(params),
  });
}

export function useSpAccessDetailQuery(spId?: number) {
  return useQuery({
    queryKey: spAccessKeys.detail(spId),
    queryFn: () => getSpAccessDetail(spId as number),
    enabled: typeof spId === 'number' && Number.isFinite(spId),
  });
}

export function useSpAccessOperationRecordsQuery(spCode?: string) {
  return useQuery({
    queryKey: spAccessKeys.operationRecords(spCode),
    queryFn: () => getSpAccessOperationRecords(spCode as string),
    enabled: typeof spCode === 'string' && spCode.length > 0,
  });
}

export function useSpAccessUserWalletsQuery(params: SpAccessDetailListParams) {
  return useQuery({
    queryKey: spAccessKeys.userWallets(params),
    queryFn: () => getSpAccessUserWallets(params),
    enabled: params.spCode.length > 0,
  });
}

export function useSpAccessSubmittedTransactionsQuery(params: SpAccessDetailListParams) {
  return useQuery({
    queryKey: spAccessKeys.submittedTransactions(params),
    queryFn: () => getSpAccessSubmittedTransactions(params),
    enabled: params.spCode.length > 0,
  });
}

export function useSpAccessWalletRulesQuery() {
  return useQuery({
    queryKey: spAccessKeys.walletRules(),
    queryFn: getSpAccessWalletRules,
  });
}

export function useSpAccessTypeOptionsQuery() {
  return useQuery({
    queryKey: spAccessKeys.typeOptions(),
    queryFn: getSpAccessTypeOptions,
  });
}

export function useSpAccessStablecoinOptionsQuery() {
  return useQuery({
    queryKey: spAccessKeys.stablecoinOptions(),
    queryFn: getSpAccessStablecoinOptions,
  });
}

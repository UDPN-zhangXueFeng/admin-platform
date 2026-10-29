import { useQuery } from '@tanstack/react-query';
import {
  getSpAccessApprovalDetail,
  getSpAccessDetail,
  getSpAccessList,
  getSpAccessOperationRecords,
  getSpAccessSftpBase64,
  getSpAccessStablecoinOptions,
  getSpAccessSubmittedTransactions,
  getSpAccessTypeOptions,
  getSpAccessUserWallets,
  getSpAccessWalletRules,
} from './sp-access.api';
import { spAccessKeys } from './sp-access.keys';
import type {
  SpAccessListParams,
  SpAccessOperationRecordListParams,
  SpAccessSftpBase64Params,
  SpAccessSubmittedTransactionListParams,
  SpAccessUserWalletListParams,
} from './sp-access.model';

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

/** 审批页详情(契约字段 spRecordId,区别于 t_view 的 spId 入参)。 */
export function useSpAccessApprovalDetailQuery(spRecordId?: number) {
  return useQuery({
    queryKey: spAccessKeys.approvalDetail(spRecordId),
    queryFn: () => getSpAccessApprovalDetail(spRecordId as number),
    enabled: typeof spRecordId === 'number' && Number.isFinite(spRecordId),
  });
}

export function useSpAccessUserWalletsQuery(params: SpAccessUserWalletListParams) {
  const hasSpCode = typeof params.spCode === 'string' && params.spCode.length > 0;
  return useQuery({
    queryKey: spAccessKeys.userWallets(params),
    queryFn: () => getSpAccessUserWallets(params),
    enabled: hasSpCode,
  });
}

export function useSpAccessSubmittedTransactionsQuery(params: SpAccessSubmittedTransactionListParams) {
  const hasSpCode = typeof params.spCode === 'string' && params.spCode.length > 0;
  return useQuery({
    queryKey: spAccessKeys.submittedTransactions(params),
    queryFn: () => getSpAccessSubmittedTransactions(params),
    enabled: hasSpCode,
  });
}

export function useSpAccessOperationRecordsQuery(params: SpAccessOperationRecordListParams) {
  const hasSpCode = typeof params.spCode === 'string' && params.spCode.length > 0;
  return useQuery({
    queryKey: spAccessKeys.operationRecords(params),
    queryFn: () => getSpAccessOperationRecords(params),
    enabled: hasSpCode,
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
/**
 * 业务许可 base64 预览。params 传 null 时禁用（编辑页 detail 未就绪）。
 * data 归一化为 null（空响应语义），不返回 undefined。
 */
export function useSpAccessSftpBase64Query(params: SpAccessSftpBase64Params | null) {
  return useQuery({
    queryKey: spAccessKeys.sftpBase64(params as SpAccessSftpBase64Params),
    queryFn: () => getSpAccessSftpBase64(params as SpAccessSftpBase64Params),
    enabled: params !== null,
  });
}

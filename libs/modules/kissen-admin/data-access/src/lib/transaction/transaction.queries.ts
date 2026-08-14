'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { transactionKeys } from './transaction.keys';
import {
  getTransactionBankOptions,
  getTransactionChain,
  getTransactionDetail,
  getTransactionList,
  getTransactionLpOptions,
  getTransactionPairOptions,
} from './transaction.api';
import type { TransactionListReq } from './transaction.model';

/** 交易分页列表（翻页/筛选时保留旧数据，提升体验）。 */
export function useTransactionListQuery(
  projectId: string,
  params: TransactionListReq,
  enabled = true,
) {
  return useQuery({
    queryKey: transactionKeys.list(projectId, params),
    queryFn: ({ signal }) => getTransactionList(params, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** 交易详情（编辑回填/详情页；txId 缺省时禁用）。 */
export function useTransactionDetailQuery(
  projectId: string,
  txId: number | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey:
      txId != null
        ? transactionKeys.detail(projectId, txId)
        : [...transactionKeys.all(projectId), 'detail'],
    queryFn: ({ signal }) => getTransactionDetail(txId as number, { signal }),
    enabled: enabled && txId != null && txId > 0,
  });
}

/** 交易链路（阶段轴 + 事件流；txId 缺省时禁用）。 */
export function useTransactionChainQuery(
  projectId: string,
  txId: number | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey:
      txId != null
        ? transactionKeys.chain(projectId, txId)
        : [...transactionKeys.all(projectId), 'chain'],
    queryFn: ({ signal }) => getTransactionChain(txId as number, { signal }),
    enabled: enabled && txId != null && txId > 0,
  });
}

/** LP 下拉选项（筛选数据源）。 */
export function useTransactionLpOptionsQuery(
  projectId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: transactionKeys.lpOptions(projectId),
    queryFn: ({ signal }) => getTransactionLpOptions({ signal }),
    enabled,
  });
}

/** 货币对下拉选项（筛选数据源）。 */
export function useTransactionPairOptionsQuery(
  projectId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: transactionKeys.pairOptions(projectId),
    queryFn: ({ signal }) => getTransactionPairOptions({ signal }),
    enabled,
  });
}

/** 银行下拉选项（筛选数据源）。 */
export function useTransactionBankOptionsQuery(
  projectId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: transactionKeys.bankOptions(projectId),
    queryFn: ({ signal }) => getTransactionBankOptions({ signal }),
    enabled,
  });
}

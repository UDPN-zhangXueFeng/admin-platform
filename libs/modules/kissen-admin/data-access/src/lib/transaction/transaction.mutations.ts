'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { transactionKeys } from './transaction.keys';
import {
  queryTransactionTargetResult,
  resolveTransaction,
} from './transaction.api';
import type { TransactionResolveReq } from './transaction.model';

/**
 * 裁定前查证（2026-11-04）：问目标行「原解付到底成没成」，结果决定可用动作。
 * 不缓存，每次手动触发（网关状态随时变）。
 */
export function useQueryTargetResultMutation() {
  return useMutation({
    mutationFn: (txId: number) => queryTransactionTargetResult(txId),
  });
}

/**
 * EXCEPTION(70) 人工裁定（1 完成 / 2 失败 / 3 冲正完成 / 4 重发解付 / 5 退款）。
 * 成功后失效列表 + 该交易 detail/chain 缓存（状态由 70 迁出，列表与链路均需刷新）。
 */
export function useResolveTransactionMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TransactionResolveReq) => resolveTransaction(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: transactionKeys.lists(projectId),
      });
      queryClient.invalidateQueries({
        queryKey: transactionKeys.detail(projectId, variables.txId),
      });
      queryClient.invalidateQueries({
        queryKey: transactionKeys.chain(projectId, variables.txId),
      });
    },
  });
}

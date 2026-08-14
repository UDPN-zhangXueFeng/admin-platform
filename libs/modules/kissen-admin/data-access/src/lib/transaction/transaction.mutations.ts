'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { transactionKeys } from './transaction.keys';
import { resolveTransaction } from './transaction.api';
import type { TransactionResolveReq } from './transaction.model';

/**
 * EXCEPTION(70) 人工裁定。成功后失效列表 + 该交易 detail/chain 缓存
 * （状态由 70 迁移至 40/90/60，列表与链路均需刷新）。
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

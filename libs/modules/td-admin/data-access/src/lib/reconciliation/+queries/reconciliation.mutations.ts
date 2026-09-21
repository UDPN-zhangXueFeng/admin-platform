'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { postReserveSuspense, postTokenSuspense } from '../reconciliation.api';
import type {
  PostSuspenseReqVo,
  ReservePostSuspenseReqVo,
} from '../reconciliation.model';
import { reconciliationKeys } from './reconciliation.keys';

/**
 * real-time 挂账提交。成功后使该 reconciliationTxId 的 recon-log 及当前 Tab
 * 列表（tx-list / tx-investigation）失效，触发刷新（旧系统 `mutate()` 等价）。
 */
export function usePostTokenSuspenseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: PostSuspenseReqVo) => postTokenSuspense(params),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: reconciliationKeys.txReconLog(variables.reconciliationTxId),
      });
      queryClient.invalidateQueries({
        queryKey: [...reconciliationKeys.all, 'real-time', 'tx-list'],
      });
      queryClient.invalidateQueries({
        queryKey: [...reconciliationKeys.all, 'real-time', 'tx-investigation'],
      });
    },
  });
}

/**
 * reserve 挂账提交（后端端点缺失 R1）。feature 层以 feature-flag 隐藏挂账入口，
 * 待后端就绪后移除 flag 即可启用。成功后同样使 reserve recon-log 及列表失效。
 */
export function usePostReserveSuspenseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: ReservePostSuspenseReqVo) => postReserveSuspense(params),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: reconciliationKeys.reserveReconLog(
          variables.reconciliationReserveId,
        ),
      });
      queryClient.invalidateQueries({
        queryKey: [...reconciliationKeys.all, 'reserve', 'list'],
      });
      queryClient.invalidateQueries({
        queryKey: [...reconciliationKeys.all, 'reserve', 'investigation'],
      });
    },
  });
}

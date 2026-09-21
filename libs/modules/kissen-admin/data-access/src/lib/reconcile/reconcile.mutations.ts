'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { reconcileKeys } from './reconcile.keys';
import { reconcileReview, reconcileRun } from './reconcile.api';
import type { ReconcileReviewReq, ReconcileRunReq } from './reconcile.model';

/**
 * 执行对账。成功后失效差异列表（重跑会删除当日待处理差异并重建，已确认/已忽略保留）。
 * 返回值携带 diffCount，调用方据其提示「对账完成,发现 N 条差异」。
 */
export function useReconcileRunMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ReconcileRunReq) => reconcileRun(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reconcileKeys.lists(projectId) });
    },
  });
}

/** 处理差异（确认/忽略）。成功后失效差异列表。 */
export function useReconcileReviewMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ReconcileReviewReq) => reconcileReview(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reconcileKeys.lists(projectId) });
    },
  });
}

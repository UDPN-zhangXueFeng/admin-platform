'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { reconcileKeys } from './reconcile.keys';
import { getReconcileDiffList } from './reconcile.api';
import type { ReconcileDiffListReq } from './reconcile.model';

/** 对账差异分页列表（翻页/筛选时保留旧数据）。 */
export function useReconcileDiffListQuery(
  projectId: string,
  params: ReconcileDiffListReq,
  enabled = true,
) {
  return useQuery({
    queryKey: reconcileKeys.list(projectId, params),
    queryFn: ({ signal }) => getReconcileDiffList(params, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

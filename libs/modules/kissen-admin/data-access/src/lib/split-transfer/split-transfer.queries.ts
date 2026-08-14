'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { splitTransferKeys } from './split-transfer.keys';
import { getSplitLpOptions, getSplitTransferList } from './split-transfer.api';
import type { SplitTransferListReq } from './split-transfer.model';

/** 分成划转分页列表（翻页/筛选时保留旧数据）。 */
export function useSplitTransferListQuery(
  projectId: string,
  params: SplitTransferListReq,
  enabled = true,
) {
  return useQuery({
    queryKey: splitTransferKeys.list(projectId, params),
    queryFn: ({ signal }) => getSplitTransferList(params, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** LP 选项（列表筛选下拉数据源）。 */
export function useSplitLpOptionsQuery(projectId: string, enabled = true) {
  return useQuery({
    queryKey: splitTransferKeys.lpOptions(projectId),
    queryFn: ({ signal }) => getSplitLpOptions({ signal }),
    enabled,
  });
}

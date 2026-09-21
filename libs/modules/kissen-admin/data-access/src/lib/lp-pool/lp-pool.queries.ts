'use client';

/**
 * LP 资金池域 read-query hooks。
 * LP 选项直接消费 lp 域 useLpListQuery（本仓同包内跨域复用）。
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { lpPoolKeys } from './lp-pool.keys';
import { getLpPoolList } from './lp-pool.api';
import type { LpPoolListReq } from './lp-pool.model';

/** 资金池分页列表（翻页/筛选时保留旧数据）。 */
export function useLpPoolListQuery(
  projectId: string,
  params: LpPoolListReq,
  enabled = true,
) {
  return useQuery({
    queryKey: lpPoolKeys.list(projectId, params),
    queryFn: ({ signal }) => getLpPoolList(params, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

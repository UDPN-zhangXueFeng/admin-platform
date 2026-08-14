'use client';

/** LP 资金池域 read-query hooks。 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { lpPoolKeys } from './lp-pool.keys';
import { getLpPoolList, getLpPoolLpOptions } from './lp-pool.api';
import type { LpPoolListReq } from './lp-pool.model';

/** 资金池分页列表。 */
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

/** LP 选项（lpId 下拉数据源）。 */
export function useLpPoolLpOptionsQuery(projectId: string, enabled = true) {
  return useQuery({
    queryKey: lpPoolKeys.lpOptions(projectId),
    queryFn: ({ signal }) => getLpPoolLpOptions({ signal }),
    enabled,
  });
}

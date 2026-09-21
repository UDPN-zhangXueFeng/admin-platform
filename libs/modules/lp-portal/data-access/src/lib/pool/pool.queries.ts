'use client';

/** LP 资金池域 read-query hooks。 */
import { useQuery } from '@tanstack/react-query';

import { poolKeys } from './pool.keys';
import { getPoolList } from './pool.api';

/** 资金池全量列表（不分页，页面自行渲染）。 */
export function usePoolListQuery(projectId: string, enabled = true) {
  return useQuery({
    queryKey: poolKeys.list(projectId),
    queryFn: ({ signal }) => getPoolList({ signal }),
    enabled,
  });
}

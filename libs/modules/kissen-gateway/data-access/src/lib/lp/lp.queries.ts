'use client';

/**
 * LP 域 read-query hooks（列表按货币对筛选；筛选变更即新 key，loading 可感知）。
 */
import { useQuery } from '@tanstack/react-query';

import { lpKeys } from './lp.keys';
import { getLpList } from './lp.api';

/** LP 列表（pairId 缺省 = 全量）。 */
export function useLpListQuery(pairId?: number) {
  return useQuery({
    queryKey: lpKeys.list(pairId),
    queryFn: ({ signal }) => getLpList(pairId, { signal }),
  });
}

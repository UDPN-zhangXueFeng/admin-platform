'use client';

/** Token 对域 read-query hooks（上游 list 直返数组，无分页）。 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { tokenPairKeys } from './token-pair.keys';
import { getTokenPairList } from './token-pair.api';
import type { TokenPairListFilter } from './token-pair.model';

/** Token 对列表（数组直返，仅筛选无分页；上游语义）。 */
export function useTokenPairListQuery(
  projectId: string,
  filter: TokenPairListFilter = {},
  enabled = true,
) {
  return useQuery({
    queryKey: tokenPairKeys.list(projectId, filter),
    queryFn: ({ signal }) => getTokenPairList(filter, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

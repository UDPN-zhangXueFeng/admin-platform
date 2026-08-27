'use client';

/**
 * 统计概览域 read-query hooks（源 `views/overview/index.vue` period 切换拉取）。
 */
import { useQuery } from '@tanstack/react-query';

import { getOverviewStats } from './overview.api';
import { overviewKeys } from './overview.keys';
import type { OverviewReq } from './overview.model';

/** 统计概览（period 切换即换 query key，默认 7D）。 */
export function useOverviewStatsQuery(params?: OverviewReq, enabled = true) {
  return useQuery({
    queryKey: overviewKeys.statsWith(params ?? {}),
    queryFn: ({ signal }) => getOverviewStats(params, { signal }),
    enabled,
  });
}

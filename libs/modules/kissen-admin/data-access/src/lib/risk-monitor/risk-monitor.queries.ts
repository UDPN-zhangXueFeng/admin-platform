'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { monitorHitKeys } from './risk-monitor.keys';
import { getMonitorHitList } from './risk-monitor.api';
import type { MonitorHitListReq } from './risk-monitor.model';

/** 监控命中分页列表（翻页/筛选时保留旧数据，提升体验）。 */
export function useMonitorHitListQuery(
  projectId: string,
  params: MonitorHitListReq,
  enabled = true,
) {
  return useQuery({
    queryKey: monitorHitKeys.list(projectId, params),
    queryFn: ({ signal }) => getMonitorHitList(params, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

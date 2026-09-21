'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { getOperateLogPage } from './operate-log.api';
import { operateLogKeys } from './operate-log.keys';
import type { OperateLogListReq } from './operate-log.model';

/** 操作日志分页列表（翻页/筛选时保留旧数据）。 */
export function useOperateLogListQuery(
  projectId: string,
  params: { pageNum: number; pageSize: number; filter: OperateLogListReq },
  enabled = true,
) {
  return useQuery({
    queryKey: operateLogKeys.list(projectId, params),
    queryFn: ({ signal }) => getOperateLogPage(params, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

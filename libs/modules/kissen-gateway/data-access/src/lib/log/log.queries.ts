'use client';

/**
 * Log 域 read-query hooks（源 `views/system/log.vue` 的 load 请求生命周期）。
 * 全部接受 projectId 作为首参，query key 跨项目隔离。
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { getLogPage } from './log.api';
import { logKeys } from './log.keys';
import type { LogPageReq } from './log.model';

/** 操作日志分页列表（翻页/筛选时保留旧数据，源 v-loading）。 */
export function useLogPageQuery(
  projectId: string,
  params: LogPageReq,
  enabled = true,
) {
  return useQuery({
    queryKey: logKeys.list(projectId, params),
    queryFn: ({ signal }) => getLogPage(params, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

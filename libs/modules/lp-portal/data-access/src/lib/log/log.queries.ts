'use client';

/**
 * LP 系统操作日志域 read-query hooks（只读域，无 mutations——源无写端点）。
 *
 * keepPreviousData：翻页/改筛选重取期间保留上次成功数据（源 rows 不清空）；
 * 错误不吞，由 lp-client 拦截器统一提示。
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { logKeys } from './log.keys';
import { getLogPage } from './log.api';
import type { LogPageReq } from './log.model';

/** 操作日志分页列表（POST /lp/log/page）。 */
export function useLogPageQuery(projectId: string, params: LogPageReq) {
  return useQuery({
    queryKey: logKeys.list(projectId, params),
    queryFn: ({ signal }) => getLogPage(params, { signal }),
    placeholderData: keepPreviousData,
  });
}

/**
 * Log 域 raw API 层（源 `api/log.ts`，只读无 mutations）。
 */
import type { AxiosRequestConfig } from 'axios';
import type { PaginatedResponse } from '@myorg/shared/model';

import { kissenPage } from '../kissen-gateway-client';
import type { LogListReq, LogPageReq, LogRow } from './log.model';

/** 操作日志分页列表（POST /log/page，`{page:{pageNum,pageSize}, data:{filter}}`）。 */
export function getLogPage(
  req: LogPageReq,
  config?: AxiosRequestConfig,
): Promise<PaginatedResponse<LogRow>> {
  return kissenPage<LogRow, LogListReq>(
    '/log/page',
    { pageNum: req.pageNum, pageSize: req.pageSize, filter: req.filter },
    config,
  );
}

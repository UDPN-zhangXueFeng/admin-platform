/**
 * LP 系统操作日志域 raw API 层（源 `src/api/log.ts` 1:1）。
 *
 * lp_id 后端按登录 LP 域注入过滤，前端一律不传（源同款）。
 */
import type { AxiosRequestConfig } from 'axios';
import type { PaginatedResponse } from '@myorg/shared/model';

import { lpPage } from '../lp-client';
import type { LogListReq } from '../types';
import type { LogPageReq, LogRow } from './log.model';

/** 操作日志分页列表（POST /lp/log/page，body { page, data: filter }）。 */
export function getLogPage(
  req: LogPageReq,
  config?: AxiosRequestConfig,
): Promise<PaginatedResponse<LogRow>> {
  return lpPage<LogRow, LogListReq>(
    '/log/page',
    { pageNum: req.pageNum, pageSize: req.pageSize, filter: req.filter },
    config,
  );
}

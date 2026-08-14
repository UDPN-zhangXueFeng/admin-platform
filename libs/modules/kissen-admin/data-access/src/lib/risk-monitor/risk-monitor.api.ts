import type { AxiosRequestConfig } from 'axios';
import type { PaginatedResponse } from '@myorg/shared/model';

import { kissenPage } from '../kissen-client';
import type {
  MonitorHitFilter,
  MonitorHitListReq,
  MonitorHitRow,
} from './risk-monitor.model';

/**
 * 监控命中分页列表（POST /manage/risk-monitor/hit/list）。
 * 源 api/risk-monitor.ts monitorHitList；分页体 { page, data }。
 */
export function getMonitorHitList(
  req: MonitorHitListReq,
  config?: AxiosRequestConfig,
): Promise<PaginatedResponse<MonitorHitRow>> {
  return kissenPage<MonitorHitRow, MonitorHitFilter>(
    '/manage/risk-monitor/hit/list',
    {
      pageNum: req.pageNum,
      pageSize: req.pageSize,
      filter: req.filter,
    },
    config,
  );
}

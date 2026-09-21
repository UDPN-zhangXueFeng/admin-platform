/**
 * 统计概览域 raw API 层（源 `api/overview.ts`）。
 */
import type { AxiosRequestConfig } from 'axios';

import { kissenRequest } from '../kissen-gateway-client';
import type { OverviewReq, OverviewStats } from './overview.model';

/** 统计概览（GET /overview；period=TODAY/7D/30D/CUSTOM，CUSTOM 时带 from/to 毫秒）。 */
export function getOverviewStats(
  params?: OverviewReq,
  config?: AxiosRequestConfig,
): Promise<OverviewStats> {
  return kissenRequest.get<OverviewStats>('/overview', { ...config, params });
}

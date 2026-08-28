/**
 * Dashboard 域 raw API 层（源 `src/api/dashboard.ts` 1:1，v2.3 e591f85）。
 *
 * 路径经 lp-client baseURL 拼 /lp 前缀（GET /lp/dashboard/summary、
 * GET /lp/dashboard/volume?days=N）；本地副本只读聚合，lpId 由后端登录态注入。
 */
import type { AxiosRequestConfig } from 'axios';

import { lpRequest } from '../lp-client';
import type { DashboardSummary, VolumeRow } from './dashboard.model';

/** 统计卡 + 资金池卡片（余额/水位/预授权可用）+ 最近交易，一次聚合取全。 */
export function getDashboardSummary(
  config?: AxiosRequestConfig,
): Promise<DashboardSummary> {
  return lpRequest.get<DashboardSummary>('/dashboard/summary', config);
}

/** 近 N 天按 token 对日粒度成交量（折线图数据源；默认 7 天窗口）。 */
export function getDashboardVolume(
  days = 7,
  config?: AxiosRequestConfig,
): Promise<VolumeRow[]> {
  return lpRequest.get<VolumeRow[]>(
    `/dashboard/volume?days=${days}`,
    config,
  );
}

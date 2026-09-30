import type { AxiosRequestConfig } from 'axios';
import { kissenRequest } from '../kissen-client';
import type {
  DashboardSummary,
  DashboardPairBar,
  DashboardTrendRow,
} from './dashboard.model';

export function getDashboardSummary(
  config?: AxiosRequestConfig,
): Promise<DashboardSummary> {
  return kissenRequest.get('/manage/dashboard/summary', config);
}
export function getDashboardPairDist(
  days: number,
  config?: AxiosRequestConfig,
): Promise<DashboardPairBar[]> {
  return kissenRequest.get('/manage/dashboard/pair', {
    ...config,
    params: { days },
  });
}
export function getDashboardTrend(
  days: number,
  config?: AxiosRequestConfig,
): Promise<DashboardTrendRow[]> {
  return kissenRequest.get('/manage/dashboard/trend', {
    ...config,
    params: { days },
  });
}

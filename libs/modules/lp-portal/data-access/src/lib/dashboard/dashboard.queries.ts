'use client';

/**
 * Dashboard 域 read-query hooks（token 域同模式）。
 *
 * 源 dashboard/index.vue onMounted：`load()` + `loadVolume()` 两请求互不
 * 依赖、拦截器已提示失败——映射为两条独立 useQuery，summary 与 volume 按
 * 窗口天数分 key（切 7/14/30 天重拉，源 radio @change=loadVolume 语义）。
 */
import { useQuery } from '@tanstack/react-query';

import { isServiceDown } from '../lp-client';
import { getDashboardSummary, getDashboardVolume } from './dashboard.api';
import { dashboardKeys } from './dashboard.keys';

/**
 * 0024（kissen-api 不可用）不做重试：源无重试，立即呈现空态/降级；
 * 其余错误沿用共享 QueryClient 策略（token/pair 域同款豁免）。
 */
const retryNotServiceDown = (failureCount: number, error: unknown): boolean =>
  failureCount < 2 && !isServiceDown(error);

/** summary 聚合（统计卡四宫格 + 我的资金池 + 最近交易）。 */
export function useDashboardSummaryQuery(projectId: string) {
  return useQuery({
    queryKey: dashboardKeys.summary(projectId),
    queryFn: ({ signal }) => getDashboardSummary({ signal }),
    retry: retryNotServiceDown,
  });
}

/** 近 N 天按 token 对日粒度成交量（折线图数据源）。 */
export function useDashboardVolumeQuery(projectId: string, days: number) {
  return useQuery({
    queryKey: dashboardKeys.volume(days, projectId),
    queryFn: ({ signal }) => getDashboardVolume(days, { signal }),
    retry: retryNotServiceDown,
  });
}

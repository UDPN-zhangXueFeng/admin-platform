'use client';

/**
 * LP 货币对与资金池域 read-query hooks。
 *
 * 源 load()：`Promise.allSettled([pairApi.list(), pairApi.pairPoolList()])`
 * ——两请求互不依赖，任一侧失败/降级保留另一侧已有数据。映射为两条独立
 * useQuery（pool 域同模式）：「旧数据保留」由 TanStack 错误时保留上次成功
 * data 兜底，页面从两侧 error 推导降级条（pair 侧优先），不在 queryFn 层聚合。
 */
import { useQuery } from '@tanstack/react-query';

import { isServiceDown } from '../lp-client';
import { getPairList, getPairPoolList } from './pair.api';
import { pairKeys } from './pair.keys';

/**
 * 0024（kissen-api 不可用）不做重试：源无重试，立即呈现降级条；
 * 其余错误沿用共享 QueryClient 的策略（rate 域同款，LpApiError 无 status
 * 字段默认会被当未知错误重试，此处豁免降级码）。
 */
const retryNotServiceDown = (failureCount: number, error: unknown): boolean =>
  failureCount < 2 && !isServiceDown(error);

/** 货币对参与清单（主表数据源，不分页全量）。 */
export function usePairListQuery(projectId: string) {
  return useQuery({
    queryKey: pairKeys.list(projectId),
    queryFn: ({ signal }) => getPairList({ signal }),
    retry: retryNotServiceDown,
  });
}

/** 货币对资金池聚合（展开区数据源，页面按 pairId 建 Map O(1) 查）。 */
export function usePairPoolListQuery(projectId: string) {
  return useQuery({
    queryKey: pairKeys.poolAgg(projectId),
    queryFn: ({ signal }) => getPairPoolList({ signal }),
    retry: retryNotServiceDown,
  });
}

'use client';

/**
 * LP Token 对参与域 read-query hooks（源双 tab 各自独立 load 等价）。
 *
 * 源 Mine 挂载即载、Eligible tab-change 懒加载：映射为两条互不相干的
 * useQuery，懒加载由页面层承担（hook 只挂在激活 tab 的组件内，Radix Tabs
 * 未激活内容不挂载）。「旧数据保留」由 TanStack 错误时保留上次成功 data
 * 兜底；失败提示交 lp-client 拦截器统一 toast（源 catch 静默等价），页面
 * 不再渲染降级条。
 */
import { useQuery } from '@tanstack/react-query';

import { isServiceDown } from '../lp-client';
import { getPairEligible, getPairList } from './pair.api';
import { pairKeys } from './pair.keys';

/**
 * 0024（kissen-api 不可用）不做重试：源无重试；其余错误沿用共享 QueryClient
 * 策略（rate/split 同款豁免——LpApiError 无 status 字段默认会被当未知错误重试）。
 */
const retryNotServiceDown = (failureCount: number, error: unknown): boolean =>
  failureCount < 2 && !isServiceDown(error);

/** 我的 token 对（Mine tab 数据源，不分页全量）。 */
export function usePairListQuery(projectId: string) {
  return useQuery({
    queryKey: pairKeys.list(projectId),
    queryFn: ({ signal }) => getPairList({ signal }),
    retry: retryNotServiceDown,
  });
}

/** 可申请视图（Eligible tab 数据源，独立 key 与 Mine 互不干扰）。 */
export function usePairEligibleQuery(projectId: string) {
  return useQuery({
    queryKey: pairKeys.eligible(projectId),
    queryFn: ({ signal }) => getPairEligible({ signal }),
    retry: retryNotServiceDown,
  });
}

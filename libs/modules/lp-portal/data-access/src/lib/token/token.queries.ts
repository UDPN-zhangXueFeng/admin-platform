'use client';

/**
 * LP Token 总览域 read-query hooks。
 *
 * 源 load()：`Promise.allSettled([tokenApi.list(), tokenApi.bankGroup()])`
 * ——两视图互不依赖，任一侧失败/降级保留另一侧已有数据（01 §D3）。映射为
 * 两条独立 useQuery：「旧数据保留」由 TanStack 错误时保留上次成功 data 兜底，
 * 页面从两侧 error 推导降级条（list 侧优先，源数组序），不在 queryFn 层聚合。
 */
import { useQuery } from '@tanstack/react-query';

import { isServiceDown } from '../lp-client';
import { getBankTokenGroups, getTokenList } from './token.api';
import { tokenKeys } from './token.keys';

/**
 * 0024（kissen-api 不可用）不做重试：源无重试，立即呈现降级条；
 * 其余错误沿用共享 QueryClient 策略（pair/rate 域同款豁免）。
 */
const retryNotServiceDown = (failureCount: number, error: unknown): boolean =>
  failureCount < 2 && !isServiceDown(error);

/** token 列表（视图一数据源，body {} 默认已生效全集）。 */
export function useTokenListQuery(projectId: string) {
  return useQuery({
    queryKey: tokenKeys.list(projectId),
    queryFn: ({ signal }) => getTokenList({ signal }),
    retry: retryNotServiceDown,
  });
}

/** 按银行分组（视图二数据源；页签懒渲染但 hook 随页拉取，源 onMounted 同 load 两接口）。 */
export function useTokenBankGroupQuery(projectId: string) {
  return useQuery({
    queryKey: tokenKeys.bankGroup(projectId),
    queryFn: ({ signal }) => getBankTokenGroups({ signal }),
    retry: retryNotServiceDown,
  });
}

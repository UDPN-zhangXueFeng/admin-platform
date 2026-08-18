'use client';

import { useQuery } from '@tanstack/react-query';

import { isServiceDown } from '../lp-client';
import { lpRateKeys } from './rate.keys';
import { rateList } from './rate.api';

/**
 * 汇率全量列表（源 `rate/index.vue` load：全量拉取，客户端过滤/排序，无分页）。
 *
 * 失败时 react-query 保留上一次成功数据（源「旧 rows 保留」语义）；
 * 0024 降级由页面经 `isServiceDown(query.error)` 分流渲染降级条，
 * 非 0024 失败由 lp-client 拦截器统一 toast（页面不清数据）。
 */
export function useLpRateListQuery(projectId: string) {
  return useQuery({
    queryKey: lpRateKeys.list(projectId),
    queryFn: ({ signal }) => rateList({}, { signal }),
    // 0024（kissen-api 不可用）不做重试：源无重试，立即呈现降级条；
    // 其余错误沿用共享 QueryClient 的 5xx 两次重试策略。
    retry: (failureCount, error) => failureCount < 2 && !isServiceDown(error),
  });
}

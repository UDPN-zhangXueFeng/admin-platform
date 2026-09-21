'use client';

/**
 * LP 我的分成域 read-query hooks（pair/settle 域同模式）。
 *
 * 双卡片源语义（views/split/index.vue）：loadAll 同时拉比例与明细——两 hook
 * 独立 key 独立缓存，挂载即并行首载。keepPreviousData + TanStack 出错保留
 * 上次成功 data，即源「错误时 rows 不清空」；0024 不重试立即呈现
 * （pair 域同款 retryNotServiceDown）。
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { isServiceDown } from '../lp-client';
import { getSplitDetail, getSplitRatios } from './split.api';
import { splitKeys } from './split.keys';
import type { SplitDetailQuery } from './split.model';

const retryNotServiceDown = (failureCount: number, error: unknown): boolean =>
  failureCount < 2 && !isServiceDown(error);

/** 当前生效比例列表（不分页全量；同时供明细筛选的货币对下拉 options）。 */
export function useSplitRatiosQuery(projectId: string, enabled = true) {
  return useQuery({
    queryKey: splitKeys.ratios(projectId),
    queryFn: ({ signal }) => getSplitRatios({ signal }),
    retry: retryNotServiceDown,
    enabled,
  });
}

/** 分成明细分页（query 参与 key 身份；翻页不闪空态）。 */
export function useSplitDetailQuery(
  projectId: string,
  params: SplitDetailQuery,
  enabled = true,
) {
  return useQuery({
    queryKey: splitKeys.detail(projectId, params),
    queryFn: ({ signal }) => getSplitDetail(params, { signal }),
    placeholderData: keepPreviousData,
    retry: retryNotServiceDown,
    enabled,
  });
}

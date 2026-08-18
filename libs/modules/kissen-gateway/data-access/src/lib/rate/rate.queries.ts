'use client';

/**
 * 汇率域 read-query hooks。
 */
import { useQuery } from '@tanstack/react-query';

import { rateKeys } from './rate.keys';
import { getLatestRate } from './rate.api';

/**
 * 最新汇率快照。仅选中货币对后发起查询（源 rate.vue onPairChange 语义）；
 * pairId 为空时 query 禁用，UI 渲染「请选择货币对」空态。
 */
export function useLatestRateQuery(pairId?: number) {
  return useQuery({
    queryKey: rateKeys.latest(pairId ?? 0),
    queryFn: ({ signal }) => getLatestRate(pairId as number, { signal }),
    enabled: pairId != null,
  });
}

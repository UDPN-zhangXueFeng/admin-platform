'use client';

/**
 * LP×Token 对域 read-query hooks。
 * LP 选项直接消费 lp 域 useLpListQuery（本仓同包内跨域复用）；
 * Token 对选项为跨组数据（token-pair 域），以薄调用落在本域。
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { lpPairKeys } from './lp-pair.keys';
import { getLpPairList, getLpPairTokenPairOptions } from './lp-pair.api';
import type { LpPairListReq } from './lp-pair.model';

/** LP×Token 对分页列表（翻页/筛选时保留旧数据）。 */
export function useLpPairListQuery(
  projectId: string,
  params: LpPairListReq,
  enabled = true,
) {
  return useQuery({
    queryKey: lpPairKeys.list(projectId, params),
    queryFn: ({ signal }) => getLpPairList(params, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** Token 对选项（pairId 筛选下拉数据源；源 tokenPairList({}) 全量）。 */
export function useLpPairTokenPairOptionsQuery(
  projectId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: lpPairKeys.tokenPairOptions(projectId),
    queryFn: ({ signal }) => getLpPairTokenPairOptions({ signal }),
    enabled,
  });
}

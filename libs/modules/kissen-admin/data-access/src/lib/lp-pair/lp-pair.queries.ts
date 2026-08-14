'use client';

/** LP 货币对域 read-query hooks。 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { lpPairKeys } from './lp-pair.keys';
import {
  getLpPairCurrencyPairOptions,
  getLpPairList,
  getLpPairLpOptions,
} from './lp-pair.api';
import type { LpPairListReq } from './lp-pair.model';

/** LP 货币对分页列表。 */
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

/** LP 选项（lpId 下拉数据源）。 */
export function useLpPairLpOptionsQuery(projectId: string, enabled = true) {
  return useQuery({
    queryKey: lpPairKeys.lpOptions(projectId),
    queryFn: ({ signal }) => getLpPairLpOptions({ signal }),
    enabled,
  });
}

/** 货币对选项（pairId 下拉数据源）。 */
export function useLpPairCurrencyPairOptionsQuery(
  projectId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: lpPairKeys.currencyPairOptions(projectId),
    queryFn: ({ signal }) => getLpPairCurrencyPairOptions({ signal }),
    enabled,
  });
}

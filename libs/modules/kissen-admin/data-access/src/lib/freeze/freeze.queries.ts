'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { freezeKeys } from './freeze.keys';
import { getFreezeBankList, getFreezeLpList, getFreezePairList } from './freeze.api';
import type {
  FreezeBankFilter,
  FreezeLpFilter,
  FreezePairFilter,
} from './freeze.model';

interface FreezeListParams<F> {
  pageNum: number;
  pageSize: number;
  filter: F;
}

/** 银行冻结列表（风控聚合；按 targetType 启用，非激活类型 enabled=false 不发请求）。 */
export function useFreezeBankListQuery(
  projectId: string,
  params: FreezeListParams<FreezeBankFilter>,
  enabled = true,
) {
  return useQuery({
    queryKey: freezeKeys.bankList(projectId, params),
    queryFn: ({ signal }) => getFreezeBankList(params, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** LP 冻结列表（风控聚合；按 targetType 启用）。 */
export function useFreezeLpListQuery(
  projectId: string,
  params: FreezeListParams<FreezeLpFilter>,
  enabled = true,
) {
  return useQuery({
    queryKey: freezeKeys.lpList(projectId, params),
    queryFn: ({ signal }) => getFreezeLpList(params, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** 货币对冻结列表（风控聚合；按 targetType 启用）。 */
export function useFreezePairListQuery(
  projectId: string,
  params: FreezeListParams<FreezePairFilter>,
  enabled = true,
) {
  return useQuery({
    queryKey: freezeKeys.pairList(projectId, params),
    queryFn: ({ signal }) => getFreezePairList(params, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

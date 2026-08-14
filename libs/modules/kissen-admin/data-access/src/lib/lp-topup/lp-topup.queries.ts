'use client';

/** LP 补资域 read-query hooks。 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { lpTopupKeys } from './lp-topup.keys';
import {
  getLpTopupList,
  getLpTopupLpOptions,
  getLpTopupPoolOptions,
} from './lp-topup.api';
import type { LpTopupListReq } from './lp-topup.model';

/** 补资分页列表。 */
export function useLpTopupListQuery(
  projectId: string,
  params: LpTopupListReq,
  enabled = true,
) {
  return useQuery({
    queryKey: lpTopupKeys.list(projectId, params),
    queryFn: ({ signal }) => getLpTopupList(params, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** LP 选项（lpId 下拉数据源）。 */
export function useLpTopupLpOptionsQuery(projectId: string, enabled = true) {
  return useQuery({
    queryKey: lpTopupKeys.lpOptions(projectId),
    queryFn: ({ signal }) => getLpTopupLpOptions({ signal }),
    enabled,
  });
}

/** 资金池选项（按 lpId 联动；lpId 变更时自动重取）。 */
export function useLpTopupPoolOptionsQuery(
  projectId: string,
  lpId: number | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: lpTopupKeys.poolOptions(projectId, lpId),
    queryFn: ({ signal }) => getLpTopupPoolOptions(lpId, { signal }),
    enabled,
  });
}

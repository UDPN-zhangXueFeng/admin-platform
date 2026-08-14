'use client';

/** LP 预授权域 read-query hooks。 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { lpPreauthKeys } from './lp-preauth.keys';
import {
  getLpPreauthList,
  getLpPreauthLpOptions,
  getLpPreauthPoolOptions,
} from './lp-preauth.api';
import type { LpPreauthListReq } from './lp-preauth.model';

/** 预授权分页列表。 */
export function useLpPreauthListQuery(
  projectId: string,
  params: LpPreauthListReq,
  enabled = true,
) {
  return useQuery({
    queryKey: lpPreauthKeys.list(projectId, params),
    queryFn: ({ signal }) => getLpPreauthList(params, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** LP 选项（lpId 下拉数据源）。 */
export function useLpPreauthLpOptionsQuery(
  projectId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: lpPreauthKeys.lpOptions(projectId),
    queryFn: ({ signal }) => getLpPreauthLpOptions({ signal }),
    enabled,
  });
}

/** 资金池选项（按 lpId 联动；lpId 变更时自动重取）。 */
export function useLpPreauthPoolOptionsQuery(
  projectId: string,
  lpId: number | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: lpPreauthKeys.poolOptions(projectId, lpId),
    queryFn: ({ signal }) => getLpPreauthPoolOptions(lpId, { signal }),
    enabled,
  });
}

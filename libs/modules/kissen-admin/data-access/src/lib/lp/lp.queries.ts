'use client';

/**
 * LP 域 read-query hooks。
 * 全部接受 projectId 作为首参，query key 跨项目隔离。
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { lpKeys } from './lp.keys';
import { getLpCurrencyPairOptions, getLpDetail, getLpList } from './lp.api';
import type { LpListReq } from './lp.model';

/** LP 分页列表（翻页/筛选时保留旧数据）。 */
export function useLpListQuery(
  projectId: string,
  params: LpListReq,
  enabled = true,
) {
  return useQuery({
    queryKey: lpKeys.list(projectId, params),
    queryFn: ({ signal }) => getLpList(params, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** LP 详情（编辑回填；lpId 无效时不发起查询）。 */
export function useLpDetailQuery(
  projectId: string,
  lpId: number | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: lpKeys.detail(projectId, lpId ?? 0),
    queryFn: ({ signal }) => getLpDetail(lpId as number, { signal }),
    enabled: enabled && lpId != null && lpId > 0,
  });
}

/** 货币对选项（LP 表单 initialPairIds 多选数据源）。 */
export function useLpCurrencyPairOptionsQuery(
  projectId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: lpKeys.currencyPairOptions(projectId),
    queryFn: ({ signal }) => getLpCurrencyPairOptions({ signal }),
    enabled,
  });
}

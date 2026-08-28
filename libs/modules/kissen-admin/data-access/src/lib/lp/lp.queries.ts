'use client';

/**
 * LP 域 read-query hooks。
 * 全部接受 projectId 作为首参，query key 跨项目隔离。
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { lpKeys } from './lp.keys';
import { getLpDetail, getLpList, getPortalAccount, lpSettleCycleList } from './lp.api';
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

/**
 * 结算周期配置页 LP 列表（SettleAgent cycle 页消费；契约导出同名 api 的 hook 形态）。
 * key 与 useLpListQuery 共用（同端点同参数同缓存）。
 */
export function useLpSettleCycleListQuery(
  projectId: string,
  params: LpListReq,
  enabled = true,
) {
  return useQuery({
    queryKey: lpKeys.list(projectId, params),
    queryFn: ({ signal }) => lpSettleCycleList(params, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** LP 详情（编辑/详情回填；lpId 无效时不发起查询）。 */
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

/** LP 门户账号状态（门户账号弹窗打开即查；lpId 无效时不发起查询）。 */
export function usePortalAccountQuery(
  projectId: string,
  lpId: number | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: lpKeys.portalAccount(projectId, lpId ?? 0),
    queryFn: ({ signal }) => getPortalAccount(lpId as number, { signal }),
    enabled: enabled && lpId != null && lpId > 0,
  });
}

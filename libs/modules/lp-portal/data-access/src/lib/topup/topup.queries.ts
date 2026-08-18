'use client';

/**
 * LP Portal 补资域 read-query hooks。
 *
 * 0024 降级语义（源 views/topup load）：keepPreviousData + refetch 错误时
 * TanStack 保留上次成功 `state.data`（isRefetchError 路径），页面据此
 * 「旧数据保留」渲染降级条；hook 不吞错误，页面用 isServiceDown(err) 分流。
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { topupKeys } from './topup.keys';
import { getTopupList, getTopupPoolOptions } from './topup.api';
import type { TopupListReq } from './topup.model';

/** 补资分页列表（POST /lp/topup/list；pool 页 top5 复用本 hook，pageSize 传 5）。 */
export function useTopupListQuery(
  projectId: string,
  params: TopupListReq,
  enabled = true,
) {
  return useQuery({
    queryKey: topupKeys.list(projectId, params),
    queryFn: ({ signal }) => getTopupList(params, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** 资金池下拉选项（POST /lp/pool/list；失败仅下拉为空，非主数据）。 */
export function useTopupPoolOptionsQuery(projectId: string, enabled = true) {
  return useQuery({
    queryKey: topupKeys.poolOptions(projectId),
    queryFn: ({ signal }) => getTopupPoolOptions({ signal }),
    enabled,
  });
}

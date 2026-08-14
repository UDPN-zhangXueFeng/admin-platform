'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { settleOrderKeys } from './settle-order.keys';
import {
  getSettleLpOptions,
  getSettleOrderDetail,
  getSettleOrderList,
} from './settle-order.api';
import type { SettleOrderListReq } from './settle-order.model';

/** 结算单分页列表（翻页/筛选时保留旧数据）。 */
export function useSettleOrderListQuery(
  projectId: string,
  params: SettleOrderListReq,
  enabled = true,
) {
  return useQuery({
    queryKey: settleOrderKeys.list(projectId, params),
    queryFn: ({ signal }) => getSettleOrderList(params, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** 结算单详情（GET）。orderId 无效时不发起查询。 */
export function useSettleOrderDetailQuery(
  projectId: string,
  orderId: number | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: settleOrderKeys.detail(projectId, orderId ?? 0),
    queryFn: ({ signal }) => getSettleOrderDetail(orderId as number, { signal }),
    enabled: enabled && orderId != null && orderId > 0,
  });
}

/** LP 选项（生成结算单弹窗 / 列表筛选下拉数据源）。 */
export function useSettleLpOptionsQuery(projectId: string, enabled = true) {
  return useQuery({
    queryKey: settleOrderKeys.lpOptions(projectId),
    queryFn: ({ signal }) => getSettleLpOptions({ signal }),
    enabled,
  });
}

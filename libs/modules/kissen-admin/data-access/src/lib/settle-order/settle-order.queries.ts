'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { settleOrderKeys } from './settle-order.keys';
import {
  getSettleItemRecords,
  getSettleLpOptions,
  getSettleOrderDetail,
  getSettleOrderItems,
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

/** LP 选项（列表筛选下拉数据源）。 */
export function useSettleLpOptionsQuery(projectId: string, enabled = true) {
  return useQuery({
    queryKey: settleOrderKeys.lpOptions(projectId),
    queryFn: ({ signal }) => getSettleLpOptions({ signal }),
    enabled,
  });
}

/**
 * 结算单分项（展开行懒加载）。staleTime=Infinity 对齐源 expandItems Map 的
 * 页面级缓存语义：某单展开加载过即不再重复请求。
 */
export function useSettleOrderItemsQuery(
  projectId: string,
  orderId: number,
  enabled = true,
) {
  return useQuery({
    queryKey: settleOrderKeys.items(projectId, orderId),
    queryFn: ({ signal }) => getSettleOrderItems(orderId, { signal }),
    enabled,
    staleTime: Infinity,
  });
}

/**
 * token 对分项逐笔结算明细（Settlement details 弹窗）。orderId/pairId 无效时不发起查询。
 */
export function useSettleItemRecordsQuery(
  projectId: string,
  orderId: number,
  pairId: number,
  enabled = true,
) {
  return useQuery({
    queryKey: settleOrderKeys.itemRecords(projectId, orderId, pairId),
    queryFn: ({ signal }) => getSettleItemRecords(orderId, pairId, { signal }),
    enabled: enabled && orderId > 0 && pairId > 0,
  });
}

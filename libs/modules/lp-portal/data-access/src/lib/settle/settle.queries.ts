'use client';

/**
 * LP Portal 结算域 read-query hooks（v2.4 6c49396 合并页口径）。
 *
 * - useSettleOrdersQuery：结算单分页（split-settle 卡3）。keepPreviousData
 *   + TanStack 出错保留上次成功 data，即源「错误时 rows 不清空」。
 * - useSettleOrderRecordsQuery：详情抽屉「结算流水（本单周期内）」按需
 *   拉取——orderId 为 null（抽屉关闭）时 disabled；源语义为 open 后请求、
 *   失败静默（拦截器已提示，页面不渲染错误横幅，仅空态）。0024 不重试
 *   立即呈现（retryNotServiceDown，pair/split 域同款）。
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { isServiceDown } from '../lp-client';
import { settleKeys } from './settle.keys';
import { getSettleOrderRecords, getSettleOrders } from './settle.api';
import type { SettleOrdersQuery } from './settle.model';

const retryNotServiceDown = (failureCount: number, error: unknown): boolean =>
  failureCount < 2 && !isServiceDown(error);

/** 结算单分页（POST /lp/settle/orders）。 */
export function useSettleOrdersQuery(
  projectId: string,
  params: SettleOrdersQuery,
  enabled = true,
) {
  return useQuery({
    queryKey: settleKeys.ordersList(projectId, params),
    queryFn: ({ signal }) => getSettleOrders(params, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/**
 * 结算单内结算流水（POST /lp/settle/order-records）。
 * `orderId === null` 时 hook disabled（抽屉关闭不请求）。
 */
export function useSettleOrderRecordsQuery(
  projectId: string,
  orderId: number | null,
) {
  return useQuery({
    queryKey: settleKeys.orderRecords(projectId, orderId ?? 0),
    queryFn: ({ signal }) => getSettleOrderRecords(orderId as number, { signal }),
    enabled: orderId !== null,
    retry: retryNotServiceDown,
  });
}

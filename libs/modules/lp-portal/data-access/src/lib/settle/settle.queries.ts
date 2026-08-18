'use client';

/**
 * LP Portal 结算域 read-query hooks。
 *
 * 双 tab 源语义（views/settle/index.vue）：records/orders 各自独立
 * loading/rows/total/pageNum/筛选——两 hook 独立 key 独立缓存，页面挂载时
 * 同时激活并行首载（源 onMounted loadRecords(1)+loadOrders(1)），切 tab
 * 不重新请求（缓存命中）。0024 降级由页面合并两侧 query.error 判定渲染
 * 共享单条 ServiceDownAlert（orders 侧 0024 也在页顶显示）；keepPreviousData
 * + TanStack refetch 出错保留上次成功 data，即源「错误时 rows 不清空」。
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { settleKeys } from './settle.keys';
import { getSettleOrders, getSettleRecords } from './settle.api';
import type { SettleOrdersQuery, SettleRecordsQuery } from './settle.model';

/** 结算流水分页（POST /lp/settle/records）。 */
export function useSettleRecordsQuery(
  projectId: string,
  params: SettleRecordsQuery,
  enabled = true,
) {
  return useQuery({
    queryKey: settleKeys.recordsList(projectId, params),
    queryFn: ({ signal }) => getSettleRecords(params, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

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

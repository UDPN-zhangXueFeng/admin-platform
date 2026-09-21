/**
 * LP Portal 结算域 raw API 层（源 `src/api/settle.ts` 1:1，v2.4 6c49396）。
 *
 * - POST /lp/settle/orders：结算单分页（含分项 items 与币种集合；筛选
 *   periodType/status 数字码）；
 * - POST /lp/settle/order-records：结算单内结算流水（按单据周期过滤；
 *   合并页详情抽屉按需拉取，body `{orderId}`，直出 SettleRecordRow[]）。
 *   v2.4 取代旧独立分页端点 /settle/records（已随上游退役删除）。
 * 路径经 lp-client baseURL 拼 /lp 前缀；lpId 由 BFF 登录域注入，前端不传。
 */
import type { AxiosRequestConfig } from 'axios';
import type { PaginatedResponse } from '@myorg/shared/model';

import { lpPage, lpRequest } from '../lp-client';
import type {
  SettleOrderListReq,
  SettleOrdersQuery,
  SettleOrderRow,
  SettleRecordRow,
} from './settle.model';

/** 结算单分页（POST /lp/settle/orders）。 */
export function getSettleOrders(
  req: SettleOrdersQuery,
  config?: AxiosRequestConfig,
): Promise<PaginatedResponse<SettleOrderRow>> {
  return lpPage<SettleOrderRow, SettleOrderListReq>(
    '/settle/orders',
    { pageNum: req.pageNum, pageSize: req.pageSize, filter: req.filter },
    config,
  );
}

/** 结算单内结算流水（POST /lp/settle/order-records；抽屉按需拉取）。 */
export function getSettleOrderRecords(
  orderId: number,
  config?: AxiosRequestConfig,
): Promise<SettleRecordRow[]> {
  return lpRequest.post<SettleRecordRow[]>(
    '/settle/order-records',
    { orderId },
    config,
  );
}

/**
 * LP Portal 结算域 raw API 层（源 `src/api/settle.ts` 1:1）。
 *
 * - POST /lp/settle/records：结算流水分页（records 表无周期列，筛选只有
 *   时间范围，不传 cycle，裁决 C-1）；
 * - POST /lp/settle/orders：结算单分页（周期筛选入参 cycle 字符串
 *   day/week/month，后端映射 period_type 1/2/3，裁决 C-1/D-7）。
 * 路径经 lp-client baseURL 拼 /lp 前缀；lpId 由 BFF 登录域注入，前端不传。
 */
import type { AxiosRequestConfig } from 'axios';
import type { PaginatedResponse } from '@myorg/shared/model';

import { lpPage } from '../lp-client';
import type {
  SettleOrderListReq,
  SettleOrdersQuery,
  SettleOrderRow,
  SettleRecordListReq,
  SettleRecordsQuery,
  SettleRecordRow,
} from './settle.model';

/** 结算流水分页（POST /lp/settle/records）。 */
export function getSettleRecords(
  req: SettleRecordsQuery,
  config?: AxiosRequestConfig,
): Promise<PaginatedResponse<SettleRecordRow>> {
  return lpPage<SettleRecordRow, SettleRecordListReq>(
    '/settle/records',
    { pageNum: req.pageNum, pageSize: req.pageSize, filter: req.filter },
    config,
  );
}

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

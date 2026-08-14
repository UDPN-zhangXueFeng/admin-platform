import type { AxiosRequestConfig } from 'axios';
import type { PaginatedResponse } from '@myorg/shared/model';

import { kissenPage, kissenRequest } from '../kissen-client';
import type {
  SettleOrderConfirmReq,
  SettleOrderGenerateReq,
  SettleOrderListFilter,
  SettleOrderListReq,
  SettleOrderRow,
} from './settle-order.model';

/** 结算单分页列表（POST /manage/settle-order/list，{ page, data }）。 */
export function getSettleOrderList(
  req: SettleOrderListReq,
  config?: AxiosRequestConfig,
): Promise<PaginatedResponse<SettleOrderRow>> {
  return kissenPage<SettleOrderRow, SettleOrderListFilter>(
    '/manage/settle-order/list',
    { pageNum: req.pageNum, pageSize: req.pageSize, filter: req.filter },
    config,
  );
}

/**
 * 结算单详情（GET /manage/settle-order/detail/{orderId}）。
 * 本域有 detail 端点，详情回填走此接口而非列表行。
 */
export function getSettleOrderDetail(
  orderId: number,
  config?: AxiosRequestConfig,
): Promise<SettleOrderRow> {
  return kissenRequest.get<SettleOrderRow>(
    `/manage/settle-order/detail/${orderId}`,
    config,
  );
}

/** 生成结算单（POST /manage/settle-order/generate）。 */
export function settleOrderGenerate(
  req: SettleOrderGenerateReq,
  config?: AxiosRequestConfig,
): Promise<{ orderId: number }> {
  return kissenRequest.post<{ orderId: number }>(
    '/manage/settle-order/generate',
    req,
    config,
  );
}

/** 提交结算单确认审批（KSC）；仅 status 5/15 可操作（POST /manage/settle-order/confirm）。 */
export function settleOrderConfirm(
  req: SettleOrderConfirmReq,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post<void>('/manage/settle-order/confirm', req, config);
}

/**
 * LP 选项（跨域薄调用）。源 generate-dialog.vue / index.vue 用 api/lp.ts 的
 * `lpList({ pageNum:1, pageSize:200, data:{} })`，此处忠实移植端点与请求体。
 */
import type { SettleLpOption } from './settle-order.model';

export async function getSettleLpOptions(
  config?: AxiosRequestConfig,
): Promise<SettleLpOption[]> {
  const res = await kissenPage<SettleLpOption, Record<string, unknown>>(
    '/manage/lp/list',
    { pageNum: 1, pageSize: 200, filter: {} },
    config,
  );
  return res.data;
}

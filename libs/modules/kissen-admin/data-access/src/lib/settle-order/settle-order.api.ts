import type { AxiosRequestConfig } from 'axios';
import type { PaginatedResponse } from '@myorg/shared/model';

import { kissenPage, kissenRequest } from '../kissen-client';
import type {
  SettleOrderConfirmReq,
  SettleOrderGenerateReq,
  SettleOrderItemRow,
  SettleOrderListFilter,
  SettleOrderListReq,
  SettleOrderRow,
  SettleOrderVoidReq,
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

/** 提交结算单确认审批（KSC）；仅 status 10 待确认可操作（POST /manage/settle-order/confirm）。 */
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

/**
 * 作废结算单（v2.0/AD-25：仅 status 10 待确认 → 45 作废；
 * 作废后同周期可重新生成，追溯流水归下期调整项）。
 */
export function settleOrderVoid(
  req: SettleOrderVoidReq,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post<void>('/manage/settle-order/void', req, config);
}

/**
 * 结算单分项（v2.0：token 对分项 + 调整项；POST /manage/settle-order/items/{orderId}）。
 * 列表展开行懒加载消费，金额为各 token 对自身货币单位。
 */
export function getSettleOrderItems(
  orderId: number,
  config?: AxiosRequestConfig,
): Promise<SettleOrderItemRow[]> {
  return kissenRequest.post<SettleOrderItemRow[]>(
    `/manage/settle-order/items/${orderId}`,
    undefined,
    config,
  );
}

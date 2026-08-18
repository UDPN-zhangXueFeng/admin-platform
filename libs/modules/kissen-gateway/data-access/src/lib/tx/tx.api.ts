/**
 * Tx 域 raw API 层（源 `api/tx.ts`）。
 */
import type { AxiosRequestConfig } from 'axios';
import type { PaginatedResponse } from '@myorg/shared/model';

import { kissenPage, kissenRequest } from '../kissen-gateway-client';
import type { TxListReq, TxMessage, TxPageReq, TxRecord } from './tx.model';

/** 交易分页列表（POST /tx/page，`{page:{pageNum,pageSize}, data:{filter}}`）。 */
export function getTxPage(
  req: TxPageReq,
  config?: AxiosRequestConfig,
): Promise<PaginatedResponse<TxRecord>> {
  return kissenPage<TxRecord, TxListReq>(
    '/tx/page',
    { pageNum: req.pageNum, pageSize: req.pageSize, filter: req.filter },
    config,
  );
}

/** 交易详情（GET /tx/detail/:transactionId）。 */
export function getTxDetail(
  transactionId: number,
  config?: AxiosRequestConfig,
): Promise<TxRecord> {
  return kissenRequest.get<TxRecord>(`/tx/detail/${transactionId}`, config);
}

/** 报文留痕列表（GET /tx/messages/:transactionId）。 */
export function getTxMessages(
  transactionId: number,
  config?: AxiosRequestConfig,
): Promise<TxMessage[]> {
  return kissenRequest.get<TxMessage[]>(`/tx/messages/${transactionId}`, config);
}

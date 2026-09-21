/**
 * Tx 域 raw API 层（源 `api/tx.ts`）。
 */
import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import type { PaginatedResponse } from '@myorg/shared/model';

import { kissenPage, kissenRequest } from '../kissen-gateway-client';
import type {
  TxChain,
  TxListReq,
  TxMessage,
  TxPageReq,
  TxRecord,
} from './tx.model';

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

/** 交易导出（POST /tx/export，CSV 文件流，非 ResultInfo；responseType blob 直通，调用方从 resp.data 建 Blob 下载）。 */
export function exportTx(
  req: TxListReq,
  config?: AxiosRequestConfig,
): Promise<AxiosResponse<Blob>> {
  return kissenRequest.post<AxiosResponse<Blob>>('/tx/export', req, {
    ...config,
    responseType: 'blob',
  });
}

/** 交易链路（GET /tx/chain/:transactionId；Kissen 侧状态迁移链 + 本地报文合并，Kissen 不可达时 kissenChain 为 null）。 */
export function getTxChain(
  transactionId: number,
  config?: AxiosRequestConfig,
): Promise<TxChain> {
  return kissenRequest.get<TxChain>(`/tx/chain/${transactionId}`, config);
}

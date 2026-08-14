import type { AxiosRequestConfig } from 'axios';
import type { PaginatedResponse } from '@myorg/shared/model';

import { kissenPage, kissenRequest } from '../kissen-client';
import type {
  TransactionChainResp,
  TransactionDetailRow,
  TransactionListReq,
  TransactionPageFilter,
  TransactionResolveReq,
  TransactionRow,
  TxBankOption,
  TxLpOption,
  TxPairOption,
} from './transaction.model';

/**
 * Transaction 域 raw API 层（源 `api/transaction.ts`）。
 *
 * 端点路径与请求体忠实于源：列表 POST 分页（`{page, data}`），详情/链路 GET，
 * 裁定 POST。跨域下拉选项（LP/货币对/银行）以薄调用从各自 list 端点取数，
 * 仅投影筛选所需字段，避免 import 他组 data-access 造成并行耦合。
 */

/** 交易分页列表（POST `/manage/transaction/page`）。 */
export function getTransactionList(
  req: TransactionListReq,
  config?: AxiosRequestConfig,
): Promise<PaginatedResponse<TransactionRow>> {
  return kissenPage<TransactionRow, TransactionPageFilter>(
    '/manage/transaction/page',
    { pageNum: req.pageNum, pageSize: req.pageSize, filter: req.filter },
    config,
  );
}

/** 交易详情（GET `/manage/transaction/detail/:txId`；不存在时后端 MSG_21_0066 透出）。 */
export function getTransactionDetail(
  txId: number,
  config?: AxiosRequestConfig,
): Promise<TransactionDetailRow> {
  return kissenRequest.get<TransactionDetailRow>(
    `/manage/transaction/detail/${txId}`,
    config,
  );
}

/** 交易链路（GET `/manage/transaction/chain/:txId`；主体 + 阶段轴 + flat 事件）。 */
export function getTransactionChain(
  txId: number,
  config?: AxiosRequestConfig,
): Promise<TransactionChainResp> {
  return kissenRequest.get<TransactionChainResp>(
    `/manage/transaction/chain/${txId}`,
    config,
  );
}

/** EXCEPTION(70) 人工裁定（POST `/manage/transaction/resolve`）。 */
export function resolveTransaction(
  req: TransactionResolveReq,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post<void>('/manage/transaction/resolve', req, config);
}

/**
 * LP 下拉选项（源 `lpList`，pageSize=200 取全量；仅投影 lpId/lpName/lpCode）。
 * 端点 `POST /manage/lp/list`，请求体 `{page:{pageNum,pageSize}, data:{}}`。
 */
export function getTransactionLpOptions(
  config?: AxiosRequestConfig,
): Promise<TxLpOption[]> {
  return kissenPage<TxLpOption>(
    '/manage/lp/list',
    { pageNum: 1, pageSize: 200 },
    config,
  ).then((res) => res.data);
}

/**
 * 货币对下拉选项（源 `currencyPairList`，pageSize=200）。
 * 端点 `POST /manage/currency-pair/list`，请求体 `{page:{pageNum,pageSize}, data:{}}`。
 */
export function getTransactionPairOptions(
  config?: AxiosRequestConfig,
): Promise<TxPairOption[]> {
  return kissenPage<TxPairOption>(
    '/manage/currency-pair/list',
    { pageNum: 1, pageSize: 200 },
    config,
  ).then((res) => res.data);
}

/**
 * 银行下拉选项（源 `bankList`，pageSize=200）。
 * 端点 `POST /manage/bank/list`，请求体 `{page:{pageNum,pageSize}, data:{}}`。
 */
export function getTransactionBankOptions(
  config?: AxiosRequestConfig,
): Promise<TxBankOption[]> {
  return kissenPage<TxBankOption>(
    '/manage/bank/list',
    { pageNum: 1, pageSize: 200 },
    config,
  ).then((res) => res.data);
}

/**
 * LP Portal 交易流水域 raw API 层（源 `src/api/txflow.ts` + `src/api/pair.ts`）。
 *
 * - POST /lp/tx-flow/list：分页列表（lpId 由 BFF 登录域注入不传；chain
 *   归属校验由 BFF/api 侧保证，前端只渲染拒绝消息）；
 * - GET /lp/tx-flow/chain/{transactionId}：链路节点（裁决 C-10：响应可为
 *   扁平数组或带 children 的树，摊平在 feature 侧）；
 * - POST /lp/pair/list：货币对选项（源 views/tx-flow loadPairOptions，
 *   不分页、失败仅下拉为空 + 货币对列回落显原始 pairId，不触发降级条）。
 *   pair 域属 pair 组（B4），此处薄调用同后端端点而不 import pair 域，
 *   避免并行域耦合（topup.api.ts 的 TopupPoolOptions 同先例）。
 */
import type { AxiosRequestConfig } from 'axios';
import type { PaginatedResponse } from '@myorg/shared/model';

import { lpPage, lpRequest } from '../lp-client';
import type { TxChainNode, TxListReq, TxRow } from '../types';
import type { TxFlowListReq } from './tx-flow.model';

/** 交易流水分页列表（POST /lp/tx-flow/list）。 */
export function getTxFlowList(
  req: TxFlowListReq,
  config?: AxiosRequestConfig,
): Promise<PaginatedResponse<TxRow>> {
  return lpPage<TxRow, TxListReq>(
    '/tx-flow/list',
    { pageNum: req.pageNum, pageSize: req.pageSize, filter: req.filter },
    config,
  );
}

/** 交易链路节点（GET /lp/tx-flow/chain/{transactionId}，未摊平原始响应）。 */
export function getTxFlowChain(
  transactionId: number,
  config?: AxiosRequestConfig,
): Promise<TxChainNode[]> {
  return lpRequest.get<TxChainNode[]>(
    `/tx-flow/chain/${transactionId}`,
    config,
  );
}

/** 货币对下拉选项行（本域仅消费 pairId 与币种展示字段）。 */
export interface TxFlowPairOption {
  pairId: number;
  sourceCurrency: string;
  targetCurrency: string;
}

/**
 * 货币对选项（POST /lp/pair/list，不分页全量返回）。
 * 源语义：选项 label `${sourceCurrency}→${targetCurrency}`、value pairId，
 * 由页面拼装并建 pairId→PairRow 映射（货币对列回落显原始 pairId）。
 */
export function getTxFlowPairOptions(
  config?: AxiosRequestConfig,
): Promise<TxFlowPairOption[]> {
  return lpRequest.post<TxFlowPairOption[]>('/pair/list', {}, config);
}

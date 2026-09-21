'use client';

/**
 * LP Portal 交易流水域 read-query hooks。
 *
 * 0024 降级语义（源 views/tx-flow load/loadChain）：keepPreviousData +
 * refetch 出错时 TanStack 保留上次成功 `state.data`（「旧数据保留」），
 * 页面据 isServiceDown(err) 分流渲染降级条；hook 不吞错误。
 * 0024 不重试（源单次请求、立即呈现降级条；其余错误沿用共享
 * QueryClient 的 5xx 两次重试策略）——rate 域同先例。
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { isServiceDown } from '../lp-client';
import { txFlowKeys } from './tx-flow.keys';
import { getTxFlowChain, getTxFlowList, getTxFlowPairOptions } from './tx-flow.api';
import type { TxFlowListReq } from './tx-flow.model';

/** 交易流水分页列表（POST /lp/tx-flow/list；pageSize 由页面固定 10）。 */
export function useTxFlowListQuery(projectId: string, params: TxFlowListReq) {
  return useQuery({
    queryKey: txFlowKeys.list(projectId, params),
    queryFn: ({ signal }) => getTxFlowList(params, { signal }),
    placeholderData: keepPreviousData,
    retry: (failureCount, error) => failureCount < 2 && !isServiceDown(error),
  });
}

/** 交易链路节点（GET /lp/tx-flow/chain/{transactionId}；抽屉挂载即取）。 */
export function useTxFlowChainQuery(
  projectId: string,
  transactionId: number,
  enabled = true,
) {
  return useQuery({
    queryKey: txFlowKeys.chain(projectId, transactionId),
    queryFn: ({ signal }) => getTxFlowChain(transactionId, { signal }),
    enabled,
    retry: (failureCount, error) => failureCount < 2 && !isServiceDown(error),
  });
}

/** 货币对下拉选项（POST /lp/pair/list；失败仅下拉为空，非主数据）。 */
export function useTxFlowPairOptionsQuery(projectId: string, enabled = true) {
  return useQuery({
    queryKey: txFlowKeys.pairOptions(projectId),
    queryFn: ({ signal }) => getTxFlowPairOptions({ signal }),
    enabled,
  });
}

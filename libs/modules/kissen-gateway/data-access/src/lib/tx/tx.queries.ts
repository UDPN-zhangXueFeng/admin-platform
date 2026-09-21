'use client';

/**
 * Tx 域 read-query hooks（源 `views/tx/list.vue` 的 load/openDetail 请求生命周期）。
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { getTxChain, getTxDetail, getTxMessages, getTxPage } from './tx.api';
import type { TxPageReq } from './tx.model';

/** Tx query key factory（维度：列表=分页+筛选条件，详情/报文/链路=transactionId）。 */
export const txKeys = {
  all: ['kissen-gateway', 'tx'] as const,
  lists: () => [...txKeys.all, 'list'] as const,
  list: (params: TxPageReq) => [...txKeys.lists(), params] as const,
  details: () => [...txKeys.all, 'detail'] as const,
  detail: (transactionId: number) => [...txKeys.details(), transactionId] as const,
  messages: (transactionId: number) =>
    [...txKeys.all, 'messages', transactionId] as const,
  chain: (transactionId: number) =>
    [...txKeys.all, 'chain', transactionId] as const,
} as const;

/** 交易分页列表（翻页/筛选时保留旧数据，源 v-loading）。 */
export function useTxPage(params: TxPageReq, enabled = true) {
  return useQuery({
    queryKey: txKeys.list(params),
    queryFn: ({ signal }) => getTxPage(params, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** 交易详情（transactionId 无效时不发起查询）。 */
export function useTxDetail(transactionId: number | undefined, enabled = true) {
  return useQuery({
    queryKey: txKeys.detail(transactionId ?? 0),
    queryFn: ({ signal }) => getTxDetail(transactionId as number, { signal }),
    enabled: enabled && transactionId != null && transactionId > 0,
  });
}

/** 交易报文留痕列表（transactionId 无效时不发起查询）。 */
export function useTxMessages(transactionId: number | undefined, enabled = true) {
  return useQuery({
    queryKey: txKeys.messages(transactionId ?? 0),
    queryFn: ({ signal }) => getTxMessages(transactionId as number, { signal }),
    enabled: enabled && transactionId != null && transactionId > 0,
  });
}

/** 交易链路（本地报文 + Kissen 状态迁移链；transactionId 无效时不发起查询）。 */
export function useTxChain(transactionId: number | undefined, enabled = true) {
  return useQuery({
    queryKey: txKeys.chain(transactionId ?? 0),
    queryFn: ({ signal }) => getTxChain(transactionId as number, { signal }),
    enabled: enabled && transactionId != null && transactionId > 0,
  });
}

'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  getBlockchainList,
  getJournalDetail,
  getJournalList,
  getStablecoinSearches,
} from '../journal-entries-new.api';
import type {
  BlockchainOption,
  JournalDetailData,
  JournalListParams,
  JournalListResponse,
  StablecoinSearchOption,
} from '../journal-entries-new.model';
import { journalEntriesKeys } from './journal-entries-new.keys';

/**
 * Journal 列表查询 hook（服务端分页）。
 *
 * 使用 `keepPreviousData` 让翻页 / 筛选切换时旧数据保持可见，
 * 与源项目 `useSWR` 的体验一致。
 */
export function useJournalListQuery(params: JournalListParams) {
  return useQuery<JournalListResponse>({
    queryKey: journalEntriesKeys.list(params),
    queryFn: ({ signal }) => getJournalList(params, { signal }),
    placeholderData: keepPreviousData,
  });
}

/**
 * Journal 详情查询 hook。
 *
 * `tdTxId` 缺失时不发起请求（`enabled`）。
 */
export function useJournalDetailQuery(
  tdTxId: number | undefined,
  enabled = true
) {
  return useQuery<JournalDetailData>({
    queryKey: journalEntriesKeys.detail(tdTxId ?? 0),
    queryFn: ({ signal }) => getJournalDetail(tdTxId as number, { signal }),
    enabled: Boolean(tdTxId) && enabled,
  });
}

/** 启用 stablecoin 下拉查询 hook。 */
export function useStablecoinSearchesQuery() {
  return useQuery<StablecoinSearchOption[]>({
    queryKey: journalEntriesKeys.stablecoins(),
    queryFn: ({ signal }) => getStablecoinSearches({ signal }),
  });
}

/** 区块链下拉查询 hook。 */
export function useBlockchainListQuery() {
  return useQuery<BlockchainOption[]>({
    queryKey: journalEntriesKeys.blockchains(),
    queryFn: ({ signal }) => getBlockchainList({ signal }),
  });
}

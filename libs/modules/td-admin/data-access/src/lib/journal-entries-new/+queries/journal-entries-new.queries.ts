'use client';

import { keepPreviousData, skipToken, useQuery } from '@tanstack/react-query';
import { ApiError } from '@myorg/shared/data-access-api';
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

// A business rejection in a successful HTTP response is final, not a transient query failure.
const retryJournalRead = (failureCount: number, error: Error) =>
  !(error instanceof ApiError && error.status < 500 && error.status > 0) && failureCount < 2;

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
    retry: retryJournalRead,
  });
}

/**
 * Journal 详情查询 hook。
 *
 * `tdTxId` 缺失时不发起请求（`enabled`）。
 */
export function useJournalDetailQuery(tdTxId: string | undefined) {
  return useQuery<JournalDetailData | null>({
    queryKey: journalEntriesKeys.detail(tdTxId ?? ''),
    queryFn: tdTxId ? ({ signal }) => getJournalDetail(tdTxId, { signal }) : skipToken,
    retry: retryJournalRead,
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

'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  getPostingBookDetail,
  getPostingBooks,
  getPostingEventAccounts,
  getPostingEventDetail,
  getPostingEventList,
  getPostingHistoryList,
  updatePostingEvent,
} from '../posting-engine.api';
import type {
  PostingAccountOption,
  PostingBook,
  PostingBookListParams,
  PostingBookListResponse,
  PostingEvent,
  PostingEventListParams,
  PostingEventListResponse,
  PostingHistoryListParams,
  PostingHistoryListResponse,
  SavePostingEventDTO,
} from '../posting-engine.model';
import { postingEngineKeys } from './posting-engine.keys';

/**
 * 账本列表查询（服务端分页）。
 *
 * `keepPreviousData` 让翻页 / 筛选切换时旧数据保持可见。
 */
export function usePostingBooksQuery(params: PostingBookListParams) {
  return useQuery<PostingBookListResponse>({
    queryKey: postingEngineKeys.booksList(params),
    queryFn: ({ signal }) => getPostingBooks(params, { signal }),
    placeholderData: keepPreviousData,
  });
}

/** 账本详情查询。`financeBookId` 缺失时不发起请求。 */
export function usePostingBookDetailQuery(
  financeBookId: number | undefined,
  enabled = true
) {
  return useQuery<PostingBook>({
    queryKey: postingEngineKeys.bookDetail(financeBookId ?? 0),
    queryFn: ({ signal }) =>
      getPostingBookDetail(financeBookId as number, { signal }),
    enabled: Boolean(financeBookId) && enabled,
  });
}

/** 事件列表查询（Matrix-of-events tab，按账本分页）。 */
export function usePostingEventListQuery(
  params: PostingEventListParams,
  enabled = true
) {
  return useQuery<PostingEventListResponse>({
    queryKey: postingEngineKeys.eventList(params),
    queryFn: ({ signal }) => getPostingEventList(params, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** 事件详情查询（事件详情 + 编辑页用）。`postingEventId` 缺失时不发起请求。 */
export function usePostingEventDetailQuery(
  postingEventId: number | undefined,
  enabled = true
) {
  return useQuery<PostingEvent>({
    queryKey: postingEngineKeys.eventDetail(postingEventId ?? 0),
    queryFn: ({ signal }) =>
      getPostingEventDetail(postingEventId as number, { signal }),
    enabled: Boolean(postingEventId) && enabled,
  });
}

/**
 * 事件 Dr/Cr 科目选项查询（编辑页懒加载下拉用）。
 *
 * 默认 `enabled=false`，由编辑页在 `onDropdownVisibleChange` 时按 direction 触发，
 * 复刻源项目「打开下拉才请求」的行为（配合 ref 去重防竞态，见编辑页）。
 */
export function usePostingEventAccountsQuery(
  postingEventId: number | undefined,
  direction: number | undefined,
  enabled = false
) {
  return useQuery<PostingAccountOption[]>({
    queryKey: postingEngineKeys.eventAccounts(
      postingEventId ?? 0,
      direction ?? 0
    ),
    queryFn: ({ signal }) =>
      getPostingEventAccounts(
        postingEventId as number,
        direction as number,
        { signal }
      ),
    enabled: Boolean(postingEventId) && direction !== undefined && enabled,
  });
}

/** 版本历史查询（Version History tab，分页）。 */
export function usePostingHistoryListQuery(
  params: PostingHistoryListParams,
  enabled = true
) {
  return useQuery<PostingHistoryListResponse>({
    queryKey: postingEngineKeys.historyList(params),
    queryFn: ({ signal }) => getPostingHistoryList(params, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/**
 * 更新记账事件 mutation（编辑页保存）。
 *
 * 成功后失效事件维度缓存（列表 + 当前详情），确保返回详情页时数据刷新。
 */
export function useUpdatePostingEventMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: SavePostingEventDTO) => updatePostingEvent(dto),
    onSuccess: (_data, dto) => {
      void queryClient.invalidateQueries({ queryKey: postingEngineKeys.events() });
      void queryClient.invalidateQueries({
        queryKey: postingEngineKeys.eventDetail(dto.postingEventId),
      });
    },
  });
}

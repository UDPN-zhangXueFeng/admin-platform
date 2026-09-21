import { apiClient, type ApiRequestConfig } from '@myorg/shared/data-access-api';
import type {
  PostingAccountOption,
  PostingBook,
  PostingBookListParams,
  PostingBookListResponse,
  PostingEvent,
  PostingEventListParams,
  PostingEventListResponse,
  PostingHistoryItem,
  PostingHistoryListParams,
  PostingHistoryListResponse,
  ResultPageInfo,
  SavePostingEventDTO,
} from './posting-engine.model';

/**
 * Posting Engine API。
 *
 * 所有 endpoint base：`/api/finance/v1/finance/posting/`（已从 td-manage typings 确认）。
 * `apiClient` 自动解包 `{ code, message, data }` 信封并在 `code !== 0` 时抛错，
 * 因此各函数返回值即信封内的 `data`。列表/详情响应在返回前注入字符串 `id`
 * 以满足 DataTable `{ id: string }` 契约。
 */
const POSTING_BASE = '/api/finance/v1/finance/posting';
const BOOKS_URL = `${POSTING_BASE}/books`;
const BOOK_DETAIL_URL = `${POSTING_BASE}/book-detail`;
const EVENT_LIST_URL = `${POSTING_BASE}/list`;
const EVENT_DETAIL_URL = `${POSTING_BASE}/detail`;
const EVENT_ACCOUNTS_URL = `${POSTING_BASE}/event-accounts`;
const HISTORY_LIST_URL = `${POSTING_BASE}/history/list`;
const UPDATE_URL = `${POSTING_BASE}/update`;

/** 后端原始行（无 `id`）。仅用于在 API 层完成 `id` 注入，不对外暴露。 */
type PostingBookApi = Omit<PostingBook, 'id'>;
type PostingEventApi = Omit<PostingEvent, 'id'>;
type PostingHistoryApi = Omit<PostingHistoryItem, 'id'>;

/** 列表响应原始结构（rows 无 `id`）。 */
interface ListResponseApi<TRow> {
  page?: ResultPageInfo;
  rows?: TRow[];
}

/**
 * 查询过账账本列表（books，服务端分页）。
 *
 * 请求体结构与源项目一致：`{ data: filters, page: { pageNum, pageSize } }`。
 */
export async function getPostingBooks(
  params: PostingBookListParams,
  config?: ApiRequestConfig
): Promise<PostingBookListResponse> {
  const response = await apiClient.post<ListResponseApi<PostingBookApi>>(
    BOOKS_URL,
    {
      data: params.filters,
      page: { pageNum: params.pageNum, pageSize: params.pageSize },
    },
    config
  );

  return {
    page: response.page,
    rows: (response.rows ?? []).map((row): PostingBook => ({
      ...row,
      id: String(row.financeBookId ?? ''),
    })),
  };
}

/**
 * 查询账本详情（book-detail，单个账本）。
 */
export async function getPostingBookDetail(
  financeBookId: number | string,
  config?: ApiRequestConfig
): Promise<PostingBook> {
  const row = await apiClient.get<PostingBookApi>(
    `${BOOK_DETAIL_URL}/${financeBookId}`,
    config
  );
  return { ...row, id: String(row.financeBookId ?? financeBookId) };
}

/**
 * 查询事件列表（list，按账本维度分页；Matrix-of-events tab 用）。
 */
export async function getPostingEventList(
  params: PostingEventListParams,
  config?: ApiRequestConfig
): Promise<PostingEventListResponse> {
  const response = await apiClient.post<ListResponseApi<PostingEventApi>>(
    EVENT_LIST_URL,
    {
      data: { financeBookId: params.financeBookId },
      page: { pageNum: params.pageNum, pageSize: params.pageSize },
    },
    config
  );

  return {
    page: response.page,
    rows: (response.rows ?? []).map((row): PostingEvent => ({
      ...row,
      id: String(row.postingEventId ?? ''),
    })),
  };
}

/**
 * 查询事件详情（detail，含账户映射明细；事件详情 + 编辑页用）。
 */
export async function getPostingEventDetail(
  postingEventId: number | string,
  config?: ApiRequestConfig
): Promise<PostingEvent> {
  const row = await apiClient.get<PostingEventApi>(
    `${EVENT_DETAIL_URL}/${postingEventId}`,
    config
  );
  return { ...row, id: String(row.postingEventId ?? postingEventId) };
}

/**
 * 查询记账事件科目（按借贷方向；编辑页 Dr/Cr 下拉用）。
 *
 * `direction`：1=Debit，2=Credit。
 */
export function getPostingEventAccounts(
  postingEventId: number | string,
  direction: number,
  config?: ApiRequestConfig
): Promise<PostingAccountOption[]> {
  return apiClient.get<PostingAccountOption[]>(
    `${EVENT_ACCOUNTS_URL}/${postingEventId}?direction=${direction}`,
    config
  );
}

/**
 * 查询版本历史（history/list，Version History tab 用）。
 */
export async function getPostingHistoryList(
  params: PostingHistoryListParams,
  config?: ApiRequestConfig
): Promise<PostingHistoryListResponse> {
  const response = await apiClient.post<ListResponseApi<PostingHistoryApi>>(
    HISTORY_LIST_URL,
    {
      data: params.filters,
      page: { pageNum: params.pageNum, pageSize: params.pageSize },
    },
    config
  );

  return {
    page: response.page,
    rows: (response.rows ?? []).map((row): PostingHistoryItem => ({
      ...row,
      id: String(row.recordId ?? ''),
    })),
  };
}

/**
 * 更新记账事件（update；编辑页保存用）。
 *
 * NOTE: 请求体按 `PostingEventUpdateReqVo` 直传（未包裹 `{ data }`）。
 * 若后端实际要求包裹，需在此调整——迁移时按 typings 的直传形态实现。
 */
export async function updatePostingEvent(
  dto: SavePostingEventDTO,
  config?: ApiRequestConfig
): Promise<PostingEvent> {
  const row = await apiClient.post<PostingEventApi>(UPDATE_URL, dto, config);
  return { ...row, id: String(row.postingEventId ?? dto.postingEventId) };
}

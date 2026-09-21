import type {
  PostingBookListParams,
  PostingEventListParams,
  PostingHistoryListParams,
} from '../posting-engine.model';

/**
 * TanStack Query key 工厂。
 *
 * 始终通过这些助手生成 key，避免内联字符串数组导致缓存失效不一致。
 */
export const postingEngineKeys = {
  /** 模块根 key。 */
  all: ['posting-engine'] as const,

  /** 账本维度 key 前缀。 */
  books: () => [...postingEngineKeys.all, 'books'] as const,

  /** 账本列表 key（分页 + 筛选）。 */
  booksList: (params: PostingBookListParams) =>
    [...postingEngineKeys.books(), 'list', params] as const,

  /** 账本详情 key。 */
  bookDetail: (financeBookId: number | string) =>
    [...postingEngineKeys.books(), 'detail', financeBookId] as const,

  /** 事件维度 key 前缀。 */
  events: () => [...postingEngineKeys.all, 'events'] as const,

  /** 事件列表 key（按账本 + 分页）。 */
  eventList: (params: PostingEventListParams) =>
    [...postingEngineKeys.events(), 'list', params] as const,

  /** 事件详情 key。 */
  eventDetail: (postingEventId: number | string) =>
    [...postingEngineKeys.events(), 'detail', postingEventId] as const,

  /** 事件 Dr/Cr 科目选项 key。 */
  eventAccounts: (postingEventId: number | string, direction: number) =>
    [...postingEngineKeys.events(), 'accounts', postingEventId, direction] as const,

  /** 版本历史 key 前缀。 */
  history: () => [...postingEngineKeys.all, 'history'] as const,

  /** 版本历史列表 key。 */
  historyList: (params: PostingHistoryListParams) =>
    [...postingEngineKeys.history(), 'list', params] as const,
} as const;

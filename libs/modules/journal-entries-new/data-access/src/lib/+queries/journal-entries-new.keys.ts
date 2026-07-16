import type { JournalListParams } from '../journal-entries-new.model';

/**
 * TanStack Query key 工厂。
 *
 * 始终通过这些助手生成 key，避免内联字符串数组导致缓存失效不一致。
 */
export const journalEntriesKeys = {
  /** 模块根 key。 */
  all: ['journal-entries-new'] as const,

  /** 列表 key 前缀。 */
  lists: () => [...journalEntriesKeys.all, 'list'] as const,

  /** 具体分页 + 筛选的列表 key。 */
  list: (params: JournalListParams) =>
    [...journalEntriesKeys.lists(), params] as const,

  /** 详情页根 key。 */
  details: () => [...journalEntriesKeys.all, 'detail'] as const,

  /** 具体 journal 详情 key。 */
  detail: (tdTxId: number | string) =>
    [...journalEntriesKeys.details(), tdTxId] as const,

  /** 公共下拉 key 前缀。 */
  options: () => [...journalEntriesKeys.all, 'options'] as const,

  /** stablecoin 下拉 key。 */
  stablecoins: () => [...journalEntriesKeys.options(), 'stablecoins'] as const,

  /** 区块链下拉 key。 */
  blockchains: () => [...journalEntriesKeys.options(), 'blockchains'] as const,
} as const;

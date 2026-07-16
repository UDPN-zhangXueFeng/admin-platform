import type { SuspenseAdjustmentListQuery } from '../suspense-adjustment.model';

/**
 * TanStack Query key 工厂。
 *
 * 始终通过这些助手生成 key，避免内联字符串数组导致缓存失效不一致。
 */
export const suspenseAdjustmentKeys = {
  /** 模块根 key。 */
  all: ['suspense-adjustment'] as const,

  /** 列表维度 key 前缀。 */
  lists: () => [...suspenseAdjustmentKeys.all, 'lists'] as const,

  /** 列表 key（筛选条件）。 */
  list: (query: SuspenseAdjustmentListQuery) =>
    [...suspenseAdjustmentKeys.lists(), query] as const,

  /** 暂记分录详情 key（suspenseRecordId）。 */
  entryDetail: (suspenseRecordId: number | string) =>
    [...suspenseAdjustmentKeys.all, 'entry-detail', suspenseRecordId] as const,

  /** 调账 / 审批详情 key（adjustmentId）。 */
  adjustmentDetail: (adjustmentId: number | string) =>
    [...suspenseAdjustmentKeys.all, 'adjustment-detail', adjustmentId] as const,

  /** 科目下拉 key（financeBookId）。 */
  accountOptions: (financeBookId: number | string) =>
    [...suspenseAdjustmentKeys.all, 'account-options', financeBookId] as const,
} as const;

import type { ChartOfAccountsListParams } from '../chart-of-accounts.model';

/**
 * TanStack Query key 工厂。
 *
 * 始终通过这些助手生成 key，避免内联字符串数组导致缓存失效不一致。
 */
export const chartOfAccountsKeys = {
  /** 模块根 key。 */
  all: ['chart-of-accounts'] as const,

  /** 列表 key 前缀。 */
  lists: () => [...chartOfAccountsKeys.all, 'list'] as const,

  /** 具体分页 + 筛选的列表 key。 */
  list: (params: ChartOfAccountsListParams) =>
    [...chartOfAccountsKeys.lists(), params] as const,

  /** 货币下拉 key。 */
  currencies: () => [...chartOfAccountsKeys.all, 'currencies'] as const,

  // ── 详情页 ──
  /** 详情页根 key。 */
  details: () => [...chartOfAccountsKeys.all, 'detail'] as const,

  /** 账本基本信息 key。 */
  coaBasicInfo: (financeBookId: number) =>
    [...chartOfAccountsKeys.details(), 'basic-info', financeBookId] as const,

  /** COA 树 key 前缀（供 mutation invalidate）。 */
  coaTrees: () => [...chartOfAccountsKeys.details(), 'coa-tree'] as const,

  /** 具体账本的 COA 树 key。 */
  coaTree: (financeBookId: number) =>
    [...chartOfAccountsKeys.coaTrees(), financeBookId] as const,

  /** EOD 余额列表 key。 */
  eodBalances: (
    financeBookId: number,
    params: { startDate?: number; endDate?: number; pageNum?: number; pageSize?: number }
  ) =>
    [...chartOfAccountsKeys.details(), 'eod-balances', financeBookId, params] as const,

  /** EOD 明细 key。 */
  eodDetail: (financeBookEodId: number | string) =>
    [...chartOfAccountsKeys.details(), 'eod-detail', financeBookEodId] as const,

  /** 试算平衡 key。 */
  trialBalance: (
    financeBookId: number,
    params: { startDate: number; endDate: number }
  ) =>
    [
      ...chartOfAccountsKeys.details(),
      'trial-balance',
      financeBookId,
      params,
    ] as const,

  /** 科目活动明细 key。 */
  trialBalanceActivity: (
    financeBookId: number,
    params: { accountCode: string; startDate: number; endDate: number }
  ) =>
    [
      ...chartOfAccountsKeys.details(),
      'trial-balance-activity',
      financeBookId,
      params,
    ] as const,

  /** 操作记录列表 key。 */
  operationRecords: (
    financeBookId: number,
    params: Record<string, unknown>
  ) =>
    [
      ...chartOfAccountsKeys.details(),
      'operation-records',
      financeBookId,
      params,
    ] as const,
} as const;

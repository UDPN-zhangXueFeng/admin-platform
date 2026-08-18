/**
 * LP Portal 结算域 query key factory（kissen-admin 同模式：一律以
 * `['project', projectId, 'settle']` 开头做缓存隔离；records/orders 两条
 * 列表线分开，互不失效——双 tab 独立筛选/分页的缓存前提）。
 */
import type { SettleOrdersQuery, SettleRecordsQuery } from './settle.model';

export const settleKeys = {
  all: (projectId: string) => ['project', projectId, 'settle'] as const,
  records: (projectId: string) =>
    [...settleKeys.all(projectId), 'records'] as const,
  recordsList: (projectId: string, params: SettleRecordsQuery) =>
    [...settleKeys.records(projectId), params] as const,
  orders: (projectId: string) =>
    [...settleKeys.all(projectId), 'orders'] as const,
  ordersList: (projectId: string, params: SettleOrdersQuery) =>
    [...settleKeys.orders(projectId), params] as const,
} as const;

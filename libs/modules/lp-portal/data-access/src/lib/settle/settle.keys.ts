/**
 * LP Portal 结算域 query key factory（kissen-admin 同模式：一律以
 * `['project', projectId, 'settle']` 开头做缓存隔离。v2.4：records 分页
 * key 随端点退役删除；orderRecords 以 orderId 为身份，抽屉关开即切换）。
 */
import type { SettleOrdersQuery } from './settle.model';

export const settleKeys = {
  all: (projectId: string) => ['project', projectId, 'settle'] as const,
  orders: (projectId: string) =>
    [...settleKeys.all(projectId), 'orders'] as const,
  ordersList: (projectId: string, params: SettleOrdersQuery) =>
    [...settleKeys.orders(projectId), params] as const,
  /** POST /lp/settle/order-records（抽屉内结算流水，orderId 参与 key 身份）。 */
  orderRecords: (projectId: string, orderId: number) =>
    [...settleKeys.all(projectId), 'order-records', orderId] as const,
} as const;

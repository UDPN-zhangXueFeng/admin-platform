import type { SettleOrderListReq } from './settle-order.model';

/** 结算单 query key factory（携带 projectId 隔离缓存）。 */
export const settleOrderKeys = {
  all: (projectId: string) => ['project', projectId, 'settle-order'] as const,
  lists: (projectId: string) =>
    [...settleOrderKeys.all(projectId), 'list'] as const,
  list: (projectId: string, params: SettleOrderListReq) =>
    [...settleOrderKeys.lists(projectId), params] as const,
  detail: (projectId: string, orderId: number) =>
    [...settleOrderKeys.all(projectId), 'detail', orderId] as const,
  /** LP 选项（生成结算单弹窗 / 筛选下拉数据源）。 */
  lpOptions: (projectId: string) =>
    [...settleOrderKeys.all(projectId), 'lpOptions'] as const,
} as const;

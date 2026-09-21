/**
 * LP Portal 交易流水域 query key factory（kissen-admin 同模式：
 * 一律以 `['project', projectId, 'tx-flow']` 开头做缓存隔离）。
 */
import type { TxFlowListReq } from './tx-flow.model';

export const txFlowKeys = {
  all: (projectId: string) => ['project', projectId, 'tx-flow'] as const,
  lists: (projectId: string) =>
    [...txFlowKeys.all(projectId), 'list'] as const,
  list: (projectId: string, params: TxFlowListReq) =>
    [...txFlowKeys.lists(projectId), params] as const,
  /** 链路节点（按交易 ID 独立缓存；抽屉重开命中同键不重复请求）。 */
  chain: (projectId: string, transactionId: number) =>
    [...txFlowKeys.all(projectId), 'chain', transactionId] as const,
  /** 货币对下拉选项（tx-flow 页筛选；与 pair 域列表缓存隔离）。 */
  pairOptions: (projectId: string) =>
    [...txFlowKeys.all(projectId), 'pairOptions'] as const,
} as const;

import type { SplitTransferListReq } from './split-transfer.model';

/** 分成划转 query key factory（携带 projectId 隔离缓存）。 */
export const splitTransferKeys = {
  all: (projectId: string) =>
    ['project', projectId, 'split-transfer'] as const,
  lists: (projectId: string) =>
    [...splitTransferKeys.all(projectId), 'list'] as const,
  list: (projectId: string, params: SplitTransferListReq) =>
    [...splitTransferKeys.lists(projectId), params] as const,
  /** LP 选项（列表筛选下拉数据源）。 */
  lpOptions: (projectId: string) =>
    [...splitTransferKeys.all(projectId), 'lpOptions'] as const,
} as const;

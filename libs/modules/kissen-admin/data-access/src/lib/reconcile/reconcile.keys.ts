import type { ReconcileDiffListReq } from './reconcile.model';

/** 对账差异 query key factory（携带 projectId 隔离缓存）。 */
export const reconcileKeys = {
  all: (projectId: string) => ['project', projectId, 'reconcile'] as const,
  lists: (projectId: string) =>
    [...reconcileKeys.all(projectId), 'diff-list'] as const,
  list: (projectId: string, params: ReconcileDiffListReq) =>
    [...reconcileKeys.lists(projectId), params] as const,
} as const;

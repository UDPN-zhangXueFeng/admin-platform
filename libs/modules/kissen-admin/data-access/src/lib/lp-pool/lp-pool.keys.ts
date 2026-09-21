import type { LpPoolListReq } from './lp-pool.model';

/** LP 资金池 query key factory（携带 projectId 隔离缓存）。 */
export const lpPoolKeys = {
  all: (projectId: string) => ['project', projectId, 'lp-pool'] as const,
  lists: (projectId: string) => [...lpPoolKeys.all(projectId), 'list'] as const,
  list: (projectId: string, params: LpPoolListReq) =>
    [...lpPoolKeys.lists(projectId), params] as const,
} as const;

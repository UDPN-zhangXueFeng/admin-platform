import type { LpPairListReq } from './lp-pair.model';

/** LP×Token 对 query key factory（携带 projectId 隔离缓存）。 */
export const lpPairKeys = {
  all: (projectId: string) => ['project', projectId, 'lp-pair'] as const,
  lists: (projectId: string) => [...lpPairKeys.all(projectId), 'list'] as const,
  list: (projectId: string, params: LpPairListReq) =>
    [...lpPairKeys.lists(projectId), params] as const,
  tokenPairOptions: (projectId: string) =>
    [...lpPairKeys.all(projectId), 'tokenPairOptions'] as const,
} as const;

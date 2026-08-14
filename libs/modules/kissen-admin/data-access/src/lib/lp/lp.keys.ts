import type { LpListReq } from './lp.model';

/** LP query key factory（携带 projectId 隔离缓存）。 */
export const lpKeys = {
  all: (projectId: string) => ['project', projectId, 'lp'] as const,
  lists: (projectId: string) => [...lpKeys.all(projectId), 'list'] as const,
  list: (projectId: string, params: LpListReq) =>
    [...lpKeys.lists(projectId), params] as const,
  detail: (projectId: string, lpId: number) =>
    [...lpKeys.all(projectId), 'detail', lpId] as const,
  currencyPairOptions: (projectId: string) =>
    [...lpKeys.all(projectId), 'currencyPairOptions'] as const,
} as const;

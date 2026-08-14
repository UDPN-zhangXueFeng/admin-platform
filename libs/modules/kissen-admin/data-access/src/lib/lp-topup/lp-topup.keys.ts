import type { LpTopupListReq } from './lp-topup.model';

/** LP 补资 query key factory（携带 projectId 隔离缓存）。 */
export const lpTopupKeys = {
  all: (projectId: string) => ['project', projectId, 'lp-topup'] as const,
  lists: (projectId: string) =>
    [...lpTopupKeys.all(projectId), 'list'] as const,
  list: (projectId: string, params: LpTopupListReq) =>
    [...lpTopupKeys.lists(projectId), params] as const,
  lpOptions: (projectId: string) =>
    [...lpTopupKeys.all(projectId), 'lpOptions'] as const,
  poolOptions: (projectId: string, lpId: number | undefined) =>
    [...lpTopupKeys.all(projectId), 'poolOptions', lpId ?? null] as const,
} as const;

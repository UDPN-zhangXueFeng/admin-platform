import type { LpPreauthListReq } from './lp-preauth.model';

/** LP 预授权 query key factory（携带 projectId 隔离缓存）。 */
export const lpPreauthKeys = {
  all: (projectId: string) => ['project', projectId, 'lp-preauth'] as const,
  lists: (projectId: string) =>
    [...lpPreauthKeys.all(projectId), 'list'] as const,
  list: (projectId: string, params: LpPreauthListReq) =>
    [...lpPreauthKeys.lists(projectId), params] as const,
  lpOptions: (projectId: string) =>
    [...lpPreauthKeys.all(projectId), 'lpOptions'] as const,
  poolOptions: (projectId: string, lpId: number | undefined) =>
    [...lpPreauthKeys.all(projectId), 'poolOptions', lpId ?? null] as const,
} as const;

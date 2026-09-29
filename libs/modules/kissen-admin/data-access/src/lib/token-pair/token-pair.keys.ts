import type { TokenPairListFilter, TokenPairListReq } from './token-pair.model';

/** Token 对 query key factory（携带 projectId 隔离缓存）。 */
export const tokenPairKeys = {
  all: (projectId: string) => ['project', projectId, 'token-pair'] as const,
  lists: (projectId: string) => [...tokenPairKeys.all(projectId), 'list'] as const,
  list: (projectId: string, req: TokenPairListReq) =>
    [...tokenPairKeys.lists(projectId), req] as const,
  listAll: (projectId: string, filter: TokenPairListFilter) =>
    [...tokenPairKeys.lists(projectId), 'all', filter] as const,
} as const;

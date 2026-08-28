import type { TokenListFilter } from './token.model';

/** Token 域 query key factory（携带 projectId 隔离缓存）。 */
export const tokenKeys = {
  all: (projectId: string) => ['project', projectId, 'token'] as const,
  lists: (projectId: string) =>
    [...tokenKeys.all(projectId), 'list'] as const,
  list: (projectId: string, filter: TokenListFilter) =>
    [...tokenKeys.lists(projectId), filter] as const,
} as const;

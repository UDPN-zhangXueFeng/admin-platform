import type { LogPageReq } from './log.model';

/** log query key factory（携带 projectId 隔离缓存，维度：列表=分页+筛选条件）。 */
export const logKeys = {
  all: (projectId: string) => ['project', projectId, 'log'] as const,
  lists: (projectId: string) => [...logKeys.all(projectId), 'list'] as const,
  list: (projectId: string, params: LogPageReq) =>
    [...logKeys.lists(projectId), params] as const,
} as const;

import type { UserPageReq } from './user.model';

/** user query key factory（携带 projectId 隔离缓存，维度：列表=分页+筛选 / 角色选项）。 */
export const userKeys = {
  all: (projectId: string) => ['project', projectId, 'user'] as const,
  lists: (projectId: string) => [...userKeys.all(projectId), 'list'] as const,
  list: (projectId: string, params: UserPageReq) =>
    [...userKeys.lists(projectId), params] as const,
  /** 角色选项（源 loadRoles，POST /role/page 前 200 条）。 */
  roleOptions: (projectId: string) =>
    [...userKeys.all(projectId), 'roleOptions'] as const,
} as const;

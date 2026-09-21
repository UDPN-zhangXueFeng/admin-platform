import type { RolePageReq } from './role.model';

/** 角色域 query key factory（携带 projectId 隔离缓存，维度：列表=分页+筛选，详情/菜单=roleId）。 */
export const roleKeys = {
  all: (projectId: string) => ['project', projectId, 'role'] as const,
  lists: (projectId: string) => [...roleKeys.all(projectId), 'list'] as const,
  list: (projectId: string, params: RolePageReq) =>
    [...roleKeys.lists(projectId), params] as const,
  details: (projectId: string) =>
    [...roleKeys.all(projectId), 'detail'] as const,
  detail: (projectId: string, roleId: number) =>
    [...roleKeys.details(projectId), roleId] as const,
  menuIds: (projectId: string, roleId: number) =>
    [...roleKeys.all(projectId), 'menuIds', roleId] as const,
} as const;

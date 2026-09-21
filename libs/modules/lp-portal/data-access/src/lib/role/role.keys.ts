/**
 * LP 系统角色域 query key factory（kissen-admin 同模式：
 * 一律以 `['project', projectId, 'role']` 开头做缓存隔离）。
 */
import type { RolePageReq } from './role.model';

export const roleKeys = {
  all: (projectId: string) => ['project', projectId, 'role'] as const,
  lists: (projectId: string) => [...roleKeys.all(projectId), 'list'] as const,
  list: (projectId: string, params: RolePageReq) =>
    [...roleKeys.lists(projectId), params] as const,
  /** user 页角色选项维度（原 role-api-only.ts 同款 key 形状，缓存连续）。 */
  options: (projectId: string) =>
    [...roleKeys.all(projectId), 'options'] as const,
  /** 单角色已分配菜单 id 集（分配菜单弹窗回显）。 */
  menuIds: (projectId: string, roleId: number) =>
    [...roleKeys.all(projectId), 'menuIds', roleId] as const,
} as const;

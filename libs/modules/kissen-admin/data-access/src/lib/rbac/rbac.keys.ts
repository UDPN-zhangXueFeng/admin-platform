import type { RoleListReq, UserListReq } from './rbac.model';

/**
 * RBAC 域 query key factory（携带 projectId 隔离缓存）。
 * 用户/角色/菜单三类共用 `rbac` 命名空间。
 */
export const rbacKeys = {
  all: (projectId: string) => ['project', projectId, 'rbac'] as const,

  // ---- 用户 ----
  userLists: (projectId: string) =>
    [...rbacKeys.all(projectId), 'user', 'list'] as const,
  userList: (
    projectId: string,
    params: { pageNum: number; pageSize: number; filter: UserListReq },
  ) => [...rbacKeys.userLists(projectId), params] as const,
  /** 用户全量（工作流审批人选择，源 loadUsers pageSize 200）。 */
  userOptions: (projectId: string) =>
    [...rbacKeys.all(projectId), 'user', 'options'] as const,

  // ---- 角色 ----
  roleLists: (projectId: string) =>
    [...rbacKeys.all(projectId), 'role', 'list'] as const,
  roleList: (
    projectId: string,
    params: { pageNum: number; pageSize: number; filter: RoleListReq },
  ) => [...rbacKeys.roleLists(projectId), params] as const,
  /** 角色全量（用户表单多选 / 详情回显，源 loadRoles pageSize 200）。 */
  roleOptions: (projectId: string) =>
    [...rbacKeys.all(projectId), 'role', 'options'] as const,
  /** 角色已分配菜单 id（GET 回显）。 */
  roleMenuIds: (projectId: string, roleId: number) =>
    [...rbacKeys.all(projectId), 'role', roleId, 'menuIds'] as const,

  // ---- 菜单 ----
  menuTree: (projectId: string) =>
    [...rbacKeys.all(projectId), 'menu', 'tree'] as const,
  /** 某菜单 key 的接口权限列表。 */
  menuPerms: (projectId: string, menuKey: string) =>
    [...rbacKeys.all(projectId), 'menu', 'perms', menuKey] as const,
} as const;

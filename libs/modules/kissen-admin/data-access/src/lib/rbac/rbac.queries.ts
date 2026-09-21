'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { rbacKeys } from './rbac.keys';
import {
  getRolePage,
  getUserPage,
  menuPermList,
  menuTree,
  roleMenuIds,
} from './rbac.api';
import type { RoleListReq, UserListReq } from './rbac.model';

/** 用户分页列表（翻页/筛选时保留旧数据）。 */
export function useRbacUserListQuery(
  projectId: string,
  params: { pageNum: number; pageSize: number; filter: UserListReq },
  enabled = true,
) {
  return useQuery({
    queryKey: rbacKeys.userList(projectId, params),
    queryFn: ({ signal }) => getUserPage(params, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** 角色分页列表（翻页/筛选时保留旧数据）。 */
export function useRbacRoleListQuery(
  projectId: string,
  params: { pageNum: number; pageSize: number; filter: RoleListReq },
  enabled = true,
) {
  return useQuery({
    queryKey: rbacKeys.roleList(projectId, params),
    queryFn: ({ signal }) => getRolePage(params, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/**
 * 角色全量（用户表单多选 / 角色详情回显）。
 * 源 loadRoles 调 rolePage pageSize 200，返回 RoleRow[]。
 */
export function useRbacRoleOptionsQuery(projectId: string, enabled = true) {
  return useQuery({
    queryKey: rbacKeys.roleOptions(projectId),
    queryFn: ({ signal }) =>
      getRolePage(
        { pageNum: 1, pageSize: 200, filter: {} },
        { signal },
      ).then((r) => r.data),
    enabled,
  });
}

/**
 * 用户全量（工作流审批人选择）。
 * 源 loadUsers 调 userPage pageSize 200，返回 UserRow[]。
 */
export function useRbacUserOptionsQuery(projectId: string, enabled = true) {
  return useQuery({
    queryKey: rbacKeys.userOptions(projectId),
    queryFn: ({ signal }) =>
      getUserPage(
        { pageNum: 1, pageSize: 200, filter: {} },
        { signal },
      ).then((r) => r.data),
    enabled,
  });
}

/** 菜单树（菜单管理 + 角色分配菜单）。 */
export function useMenuTreeQuery(projectId: string, enabled = true) {
  return useQuery({
    queryKey: rbacKeys.menuTree(projectId),
    queryFn: ({ signal }) => menuTree({ signal }),
    enabled,
  });
}

/** 角色已分配菜单 id（GET 回显），roleId 无效时不查询。 */
export function useRoleMenuIdsQuery(
  projectId: string,
  roleId: number | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: rbacKeys.roleMenuIds(projectId, roleId ?? 0),
    queryFn: ({ signal }) => roleMenuIds(roleId as number, { signal }),
    enabled: enabled && roleId != null && roleId > 0,
  });
}

/** 菜单接口权限列表，menuKey 为空时不查询。 */
export function useMenuPermListQuery(
  projectId: string,
  menuKey: string | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: rbacKeys.menuPerms(projectId, menuKey ?? ''),
    queryFn: ({ signal }) => menuPermList({ menuKey: menuKey as string }, { signal }),
    enabled: enabled && Boolean(menuKey),
  });
}

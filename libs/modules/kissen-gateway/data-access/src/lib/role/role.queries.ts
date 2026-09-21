'use client';

/**
 * 角色域 read-query hooks。
 * 全部接受 projectId 作为首参，query key 跨项目隔离。
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { getRoleDetail, getRoleMenuIds, getRolePage } from './role.api';
import { roleKeys } from './role.keys';
import type { RolePageReq } from './role.model';

/** 角色分页列表（翻页/筛选时保留旧数据，源 v-loading）。 */
export function useRolePageQuery(
  projectId: string,
  params: RolePageReq,
  enabled = true,
) {
  return useQuery({
    queryKey: roleKeys.list(projectId, params),
    queryFn: ({ signal }) => getRolePage(params, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** 角色详情（roleId 无效时不发起查询）。 */
export function useRoleDetailQuery(
  projectId: string,
  roleId: number | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: roleKeys.detail(projectId, roleId ?? 0),
    queryFn: ({ signal }) => getRoleDetail(roleId as number, { signal }),
    enabled: enabled && roleId != null && roleId > 0,
  });
}

/** 角色已勾选菜单 ID（分配弹窗回显；roleId 无效时不发起查询）。 */
export function useRoleMenuIdsQuery(
  projectId: string,
  roleId: number | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: roleKeys.menuIds(projectId, roleId ?? 0),
    queryFn: ({ signal }) => getRoleMenuIds(roleId as number, { signal }),
    enabled: enabled && roleId != null && roleId > 0,
  });
}

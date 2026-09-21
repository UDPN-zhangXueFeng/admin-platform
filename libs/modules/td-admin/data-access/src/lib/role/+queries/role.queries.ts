'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { roleKeys } from './role.keys';
import { getAllMenus, getRole, getRoleList } from '../role.api';
import type { RoleQueryParams } from '../role.model';

/**
 * 角色列表查询。`keepPreviousData` 让翻页/筛选时当前结果仍可见，直到新结果返回。
 *
 * @param projectId 项目 ID（用于 query key 隔离）。
 * @param params    筛选 + 分页参数。
 * @param enabled   可选，默认 true；用于编辑态按需拉取。
 */
export function useRoleListQuery(
  projectId: string,
  params: RoleQueryParams,
  enabled = true
) {
  return useQuery({
    queryKey: roleKeys.list(projectId, params),
    queryFn: ({ signal }) => getRoleList(params, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** 角色详情（含已授权 menuIdList）。roleId 无效时不发起查询。 */
export function useRoleDetailQuery(
  projectId: string,
  roleId: number | undefined,
  enabled = true
) {
  return useQuery({
    queryKey: roleKeys.detail(projectId, roleId ?? 0),
    queryFn: ({ signal }) => getRole(roleId as number, { signal }),
    enabled: enabled && roleId != null && roleId > 0,
  });
}

/** 全量菜单树（编辑/详情页授权树数据源）。 */
export function useMenuTreeQuery(projectId: string, enabled = true) {
  return useQuery({
    queryKey: roleKeys.menus(projectId),
    queryFn: ({ signal }) => getAllMenus({ signal }),
    enabled,
  });
}

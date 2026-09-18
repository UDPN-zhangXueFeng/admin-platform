'use client';

/**
 * User 模块 read-query hooks（user.md §3）。
 *
 * 全部接受 `projectId` 作为首参，query key 跨项目隔离。TanStack Query 拥有
 * server-state，这些 hook 仅桥接 API 调用与缓存 key。
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { userKeys } from './user.keys';
import {
  getRoleOptions,
  getTdOptions,
  getUserDetail,
  getUserList,
} from '../user.api';
import type { UserQueryParams } from '../user.model';

/**
 * 用户分页列表。`keepPreviousData` 让翻页/筛选时当前结果仍可见，直到新结果返回。
 *
 * @param projectId 项目 ID（用于 query key 隔离）。
 * @param params    筛选（userName/email）+ 分页参数。
 * @param enabled   可选，默认 true；用于编辑态按需拉取。
 */
export function useUserListQuery(
  projectId: string,
  params: UserQueryParams,
  enabled = true
) {
  return useQuery({
    queryKey: userKeys.list(projectId, params),
    queryFn: ({ signal }) => getUserList(params, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** 用户详情（含 roleIds/tdIds 用于回显/回填）。userId 无效时不发起查询。 */
export function useUserDetailQuery(
  projectId: string,
  userId: number | undefined,
  enabled = true
) {
  return useQuery({
    queryKey: userKeys.detail(projectId, userId ?? 0),
    queryFn: ({ signal }) => getUserDetail(userId as number, { signal }),
    enabled: enabled && userId != null && userId > 0,
  });
}

/** 角色选项（表单多选 + 详情回显 + 管理员角色联动判定）。 */
export function useRoleOptionsQuery(projectId: string, enabled = true) {
  return useQuery({
    queryKey: userKeys.roleOptions(projectId),
    queryFn: ({ signal }) => getRoleOptions({ signal }),
    enabled,
  });
}

/** TD（稳定币/链）选项（表单多选 + 详情回显 + 管理员角色全选数据源）。 */
export function useTdOptionsQuery(projectId: string, enabled = true) {
  return useQuery({
    queryKey: userKeys.tdOptions(projectId),
    queryFn: ({ signal }) => getTdOptions({ signal }),
    enabled,
  });
}

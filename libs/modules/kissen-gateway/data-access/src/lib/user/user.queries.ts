'use client';

/**
 * User 域 read-query hooks（源 user.vue load/loadRoles 请求生命周期）。
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { getUserPage, getUserRoleOptions } from './user.api';
import { userKeys } from './user.keys';
import type { UserPageReq } from './user.model';

/** 用户分页列表（翻页/筛选时保留旧数据，源 v-loading）。 */
export function useUserPageQuery(
  projectId: string,
  params: UserPageReq,
  enabled = true,
) {
  return useQuery({
    queryKey: userKeys.list(projectId, params),
    queryFn: ({ signal }) => getUserPage(params, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** 角色选项（源 loadRoles：空筛选取前 200 条，填表单/分配角色多选）。 */
export function useUserRoleOptionsQuery(projectId: string, enabled = true) {
  return useQuery({
    queryKey: userKeys.roleOptions(projectId),
    queryFn: ({ signal }) => getUserRoleOptions({ signal }),
    enabled,
  });
}

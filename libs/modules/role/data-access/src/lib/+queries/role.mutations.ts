'use client';

/**
 * Role module mutation hooks.
 *
 * On success each mutation invalidates the list query-key subtree so that
 * lists auto-refresh while preserving unrelated caches (detail/menus)。
 * 对齐 user.mutations.ts 的写法。
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteRole, saveRole, updateRole, updateRoleStatus } from '../role.api';
import type { RoleInsertReq, RoleStatusUpdateReq, RoleUpdateReq } from '../role.model';
import { roleKeys } from './role.keys';

/** 新建角色。 */
export function useSaveRoleMutation(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: RoleInsertReq) => saveRole(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roleKeys.lists(projectId) });
    },
  });
}

/** 更新角色（含菜单勾选）。 */
export function useUpdateRoleMutation(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: RoleUpdateReq) => updateRole(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: roleKeys.detail(projectId, variables.roleId),
      });
      queryClient.invalidateQueries({ queryKey: roleKeys.lists(projectId) });
    },
  });
}

/** 启用/禁用角色。status：0 启用 / 1 禁用。 */
export function useUpdateRoleStatusMutation(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: RoleStatusUpdateReq) => updateRoleStatus(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roleKeys.lists(projectId) });
    },
  });
}

/** 删除角色。入参为 roleId。 */
export function useDeleteRoleMutation(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (roleId: number) => deleteRole(roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roleKeys.lists(projectId) });
    },
  });
}

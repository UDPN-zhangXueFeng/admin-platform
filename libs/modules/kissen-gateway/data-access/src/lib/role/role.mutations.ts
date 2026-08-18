'use client';

/**
 * 角色域 mutation hooks。
 * 成功后按语义失效缓存（源保存/删除成功后 load() 重载列表；
 * update / assign-menu 会改详情与 menuIds 回显）。
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { assignRoleMenu, removeRole, saveRole, updateRole } from './role.api';
import { roleKeys } from './role.keys';
import type {
  RoleAssignMenuReq,
  RoleSaveReq,
  RoleUpdateReq,
} from './role.model';

/** 新建角色（POST /role/save）。 */
export function useSaveRoleMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RoleSaveReq) => saveRole(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roleKeys.lists(projectId) });
    },
  });
}

/** 编辑角色（POST /role/update；角色名/备注变化需同时失效详情）。 */
export function useUpdateRoleMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RoleUpdateReq) => updateRole(data),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: roleKeys.lists(projectId) });
      queryClient.invalidateQueries({
        queryKey: roleKeys.detail(projectId, vars.roleId),
      });
    },
  });
}

/** 删除角色（POST /role/delete/:roleId）。 */
export function useRemoveRoleMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (roleId: number) => removeRole(roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roleKeys.lists(projectId) });
    },
  });
}

/** 分配菜单（POST /role/assign-menu；menuIds 变化需失效详情与回显缓存）。 */
export function useAssignRoleMenuMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RoleAssignMenuReq) => assignRoleMenu(data),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: roleKeys.detail(projectId, vars.roleId),
      });
      queryClient.invalidateQueries({
        queryKey: roleKeys.menuIds(projectId, vars.roleId),
      });
    },
  });
}

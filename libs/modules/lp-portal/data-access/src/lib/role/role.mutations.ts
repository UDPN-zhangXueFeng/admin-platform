'use client';

/**
 * LP 系统角色域 mutation hooks（源 `views/system/role/*` 写操作）。
 *
 * 源语义：save/update/delete 成功后 `load()` 重拉当前页（React 侧由失效
 * lists 维度承担）；assign-menu 不改变角色列表字段（源 onAssignClosed
 * 不重查），故仅失效 menuIds 回显维度。失败提示由 lp-client 拦截器统一
 * 承担（源「拦截器已提示」），页面不重复 toast。
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { roleKeys } from './role.keys';
import {
  assignRoleMenus,
  removeRole,
  saveRole,
  updateRole,
} from './role.api';
import type {
  RoleAssignMenuReq,
  RoleSaveReq,
  RoleUpdateReq,
} from './role.model';

/** 新增角色（POST /lp/role/save）→ 失效角色列表。 */
export function useRoleSaveMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RoleSaveReq) => saveRole(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roleKeys.lists(projectId) });
    },
  });
}

/** 更新角色（POST /lp/role/update）→ 失效角色列表。 */
export function useRoleUpdateMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RoleUpdateReq) => updateRole(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roleKeys.lists(projectId) });
    },
  });
}

/** 删除角色（POST /lp/role/delete/{roleId}）→ 失效角色列表。 */
export function useRoleRemoveMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (roleId: number) => removeRole(roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roleKeys.lists(projectId) });
    },
  });
}

/**
 * 分配菜单（POST /lp/role/assign-menu）→ 仅失效该角色 menuIds 回显维度。
 * 授权不改角色行字段（源父页 onAssignClosed 不重查列表），故不动 lists。
 * 后端事务先删后插，空 menuIds = 清空该角色全部菜单。
 */
export function useRoleAssignMenuMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RoleAssignMenuReq) => assignRoleMenus(data),
    onSuccess: (_result, vars) => {
      queryClient.invalidateQueries({
        queryKey: roleKeys.menuIds(projectId, vars.roleId),
      });
    },
  });
}

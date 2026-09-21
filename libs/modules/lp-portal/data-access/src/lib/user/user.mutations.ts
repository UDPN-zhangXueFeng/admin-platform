'use client';

/**
 * LP 系统用户域 mutation hooks（源 `views/system/user/*` 写操作）。
 *
 * 源语义：保存/启停/分配角色成功后 `load()` 重拉当前页（React 侧由失效
 * lists 维度承担）；重置密码/强制下线不改列表数据，不失效缓存。
 * 失败提示由 lp-client 拦截器统一承担（源「拦截器已提示」），页面不重复 toast。
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { userKeys } from './user.keys';
import {
  assignUserRoles,
  forceLogoutUser,
  resetUserPwd,
  saveUser,
  toggleUserStatus,
  updateUser,
} from './user.api';
import type {
  UserAssignRoleReq,
  UserCreateReq,
  UserUpdateReq,
} from './user.model';

/** 新增用户（POST /lp/user/save，返回一次性初始密码）→ 失效用户列表。 */
export function useUserSaveMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UserCreateReq) => saveUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists(projectId) });
    },
  });
}

/** 更新用户（POST /lp/user/update）→ 失效用户列表（roleIds 随行展示）。 */
export function useUserUpdateMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UserUpdateReq) => updateUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists(projectId) });
    },
  });
}

/**
 * 启停用户（POST /lp/user/status）→ 失效用户列表。
 * 源 before-change：接口成功才允许翻转（页面先改缓存行再失效，失败不动）。
 */
export function useUserStatusMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { userId: number; status: number }) =>
      toggleUserStatus(vars.userId, vars.status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists(projectId) });
    },
  });
}

/** 重置密码（POST /lp/user/reset-pwd，返回一次性密码）→ 不失效列表。 */
export function useUserResetPwdMutation() {
  return useMutation({
    mutationFn: (userId: number) => resetUserPwd(userId),
  });
}

/** 分配角色（POST /lp/user/assign-role）→ 失效用户列表（roleIds 回显）。 */
export function useUserAssignRoleMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UserAssignRoleReq) => assignUserRoles(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists(projectId) });
    },
  });
}

/** 强制下线（POST /lp/user/force-logout/{userId}）→ 不失效列表。 */
export function useUserForceLogoutMutation() {
  return useMutation({
    mutationFn: (userId: number) => forceLogoutUser(userId),
  });
}

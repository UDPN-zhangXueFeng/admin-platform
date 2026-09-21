'use client';

/**
 * User 域 mutation hooks。
 * 列表回写语义跟随源 user.vue：save/update/status/assignRole 成功后 load()
 * 刷新列表（失效列表缓存）；resetPwd/forceLogout 源不刷新列表，故不失效。
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  userAssignRole,
  userForceLogout,
  userResetPwd,
  userSave,
  userStatus,
  userUpdate,
} from './user.api';
import { userKeys } from './user.keys';
import type {
  UserAssignRoleReq,
  UserCreateReq,
  UserToggleReq,
  UserUpdateReq,
} from './user.model';

/** 创建用户，返回一次性密码（首登强制改密）。 */
export function useUserSaveMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UserCreateReq) => userSave(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists(projectId) });
    },
  });
}

/** 更新用户。 */
export function useUserUpdateMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UserUpdateReq) => userUpdate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists(projectId) });
    },
  });
}

/** 启停用户（status 0 正常 / 1 停用）。 */
export function useUserStatusMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UserToggleReq) => userStatus(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists(projectId) });
    },
  });
}

/** 重置密码，返回一次性密码（源成功后不刷新列表）。 */
export function useUserResetPwdMutation(projectId: string) {
  void projectId;
  return useMutation({
    mutationFn: (userId: number) => userResetPwd({ userId }),
  });
}

/** 分配角色（下次请求即生效）。 */
export function useUserAssignRoleMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UserAssignRoleReq) => userAssignRole(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists(projectId) });
    },
  });
}

/** 强制下线（所有会话立即失效；源成功后不刷新列表）。 */
export function useUserForceLogoutMutation(projectId: string) {
  void projectId;
  return useMutation({
    mutationFn: (userId: number) => userForceLogout(userId),
  });
}

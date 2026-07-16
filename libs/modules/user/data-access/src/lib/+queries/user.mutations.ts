'use client';

/**
 * User module mutation hooks（user.md §3）。
 *
 * On success each mutation invalidates the list query-key subtree so that
 * lists auto-refresh while preserving unrelated caches (detail/roleOptions/tdOptions)。
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  deleteUser,
  resetUserPassword,
  saveUser,
  updateUser,
  updateUserStatus,
} from '../user.api';
import type {
  UserSaveReqVo,
  UserStatusUpdateReqVo,
  UserUpdateReqVo,
} from '../user.model';
import { userKeys } from './user.keys';

/** 新建用户。 */
export function useSaveUserMutation(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UserSaveReqVo) => saveUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists(projectId) });
    },
  });
}

/** 更新用户。 */
export function useUpdateUserMutation(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UserUpdateReqVo) => updateUser(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: userKeys.detail(projectId, variables.userId),
      });
      queryClient.invalidateQueries({ queryKey: userKeys.lists(projectId) });
    },
  });
}

/** 启用/禁用用户。status：0 启用 / 1 禁用。 */
export function useUpdateUserStatusMutation(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UserStatusUpdateReqVo) => updateUserStatus(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists(projectId) });
    },
  });
}

/** 重置密码。入参为 userId。 */
export function useResetUserPasswordMutation(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: number) => resetUserPassword(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists(projectId) });
    },
  });
}

/** 删除用户。入参为 userId。 */
export function useDeleteUserMutation(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: number) => deleteUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists(projectId) });
    },
  });
}

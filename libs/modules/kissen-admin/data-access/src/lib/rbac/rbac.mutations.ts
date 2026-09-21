'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { ChangePwdReq, LoginReq } from '../auth.model';
import { rbacKeys } from './rbac.keys';
import {
  menuDelete,
  menuPermSave,
  menuSave,
  menuUpdate,
  roleAssignMenu,
  roleDelete,
  roleSave,
  roleUpdate,
  userAssignRole,
  userChangePwd,
  userForceLogout,
  userResetPwd,
  userSave,
  userLogin,
  userLogout,
  userStatus,
  userUpdate,
} from './rbac.api';
import type {
  MenuPermissionItem,
  MenuSaveReq,
  MenuUpdateReq,
  RoleAssignMenuReq,
  RoleSaveReq,
  RoleUpdateReq,
  UserAssignRoleReq,
  UserCreateReq,
  UserToggleReq,
  UserUpdateReq,
} from './rbac.model';

/* --------------------------------- 用户 --------------------------------- */

/** 创建用户，返回一次性密码（首登强制改密）。 */
export function useUserSaveMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UserCreateReq) => userSave(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rbacKeys.userLists(projectId) });
      queryClient.invalidateQueries({ queryKey: rbacKeys.userOptions(projectId) });
    },
  });
}

/** 更新用户。 */
export function useUserUpdateMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UserUpdateReq) => userUpdate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rbacKeys.userLists(projectId) });
      queryClient.invalidateQueries({ queryKey: rbacKeys.userOptions(projectId) });
    },
  });
}

/** 启停用户（status 0 正常 / 1 停用）。 */
export function useUserStatusMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UserToggleReq) => userStatus(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rbacKeys.userLists(projectId) });
    },
  });
}

/** 重置密码，返回一次性密码。 */
export function useUserResetPwdMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) => userResetPwd({ userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rbacKeys.userLists(projectId) });
    },
  });
}

/** 分配角色（立即生效）。 */
export function useUserAssignRoleMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UserAssignRoleReq) => userAssignRole(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rbacKeys.userLists(projectId) });
    },
  });
}

/** 强制下线（所有会话立即失效）。 */
export function useUserForceLogoutMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) => userForceLogout(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rbacKeys.userLists(projectId) });
    },
  });
}


/** 自助修改密码（源 userChangePwd：POST /rbac/user/change-pwd）。 */
export function useUserChangePwdMutation() {
  return useMutation({
    mutationFn: (data: ChangePwdReq) => userChangePwd(data),
  });
}

/** 登录（源 login：POST /rbac/login），返回含 firstLogin 的 LoginRespVO。 */
export function useUserLoginMutation() {
  return useMutation({
    mutationFn: (data: LoginReq) => userLogin(data),
  });
}

/** 登出（源 logout：POST /rbac/logout）。 */
export function useUserLogoutMutation() {
  return useMutation({
    mutationFn: () => userLogout(),
  });
}

/* --------------------------------- 角色 --------------------------------- */

/** 新建角色。 */
export function useRoleSaveMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RoleSaveReq) => roleSave(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rbacKeys.roleLists(projectId) });
      queryClient.invalidateQueries({ queryKey: rbacKeys.roleOptions(projectId) });
    },
  });
}

/** 更新角色。 */
export function useRoleUpdateMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RoleUpdateReq) => roleUpdate(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: rbacKeys.roleMenuIds(projectId, variables.roleId),
      });
      queryClient.invalidateQueries({ queryKey: rbacKeys.roleLists(projectId) });
      queryClient.invalidateQueries({ queryKey: rbacKeys.roleOptions(projectId) });
    },
  });
}

/** 删除角色。 */
export function useRoleDeleteMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (roleId: number) => roleDelete(roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rbacKeys.roleLists(projectId) });
      queryClient.invalidateQueries({ queryKey: rbacKeys.roleOptions(projectId) });
    },
  });
}

/** 分配菜单（全量替换 menuIds）。 */
export function useRoleAssignMenuMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RoleAssignMenuReq) => roleAssignMenu(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: rbacKeys.roleMenuIds(projectId, variables.roleId),
      });
    },
  });
}

/* --------------------------------- 菜单 --------------------------------- */

/** 新建菜单。保存后菜单树变化（重新登录生效）。 */
export function useMenuSaveMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: MenuSaveReq) => menuSave(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rbacKeys.menuTree(projectId) });
    },
  });
}

/** 更新菜单。 */
export function useMenuUpdateMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: MenuUpdateReq) => menuUpdate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rbacKeys.menuTree(projectId) });
    },
  });
}

/** 删除菜单（存在子菜单或被角色引用将被拒绝）。 */
export function useMenuDeleteMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (menuId: number) => menuDelete(menuId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rbacKeys.menuTree(projectId) });
    },
  });
}

/** 保存菜单接口权限（全量替换）。 */
export function useMenuPermSaveMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { menuKey: string; items: MenuPermissionItem[] }) =>
      menuPermSave(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: rbacKeys.menuPerms(projectId, variables.menuKey),
      });
    },
  });
}

/**
 * User 域 raw API 层（源 `api/user.ts`）。
 *
 * 另含 `getUserRoleOptions`：源 user.vue `loadRoles` 直接调 roleApi.page
 * （POST /role/page pageSize 200）填角色多选，唯一消费方是用户页，
 * 与源码同构地落在 user 域（角色管理页面属 role 切片）。
 */
import type { AxiosRequestConfig } from 'axios';
import type { PaginatedResponse } from '@myorg/shared/model';

import { kissenPage, kissenRequest } from '../kissen-gateway-client';
import type {
  OneTimePassword,
  UserAssignRoleReq,
  UserCreateReq,
  UserListReq,
  UserPageReq,
  UserRow,
  UserRoleOption,
  UserToggleReq,
  UserUpdateReq,
} from './user.model';

/** 用户分页列表（POST /user/page，`{page:{pageNum,pageSize}, data:{filter}}`）。 */
export function getUserPage(
  req: UserPageReq,
  config?: AxiosRequestConfig,
): Promise<PaginatedResponse<UserRow>> {
  return kissenPage<UserRow, UserListReq>('/user/page', req, config);
}

/** 创建用户（POST /user/save），返回一次性密码（首登强制改密）。 */
export function userSave(
  req: UserCreateReq,
  config?: AxiosRequestConfig,
): Promise<OneTimePassword> {
  return kissenRequest.post<OneTimePassword>('/user/save', req, config);
}

/** 更新用户（POST /user/update）。 */
export function userUpdate(
  req: UserUpdateReq,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post('/user/update', req, config);
}

/** 启停用户（POST /user/status）。0 正常 / 1 停用。 */
export function userStatus(
  req: UserToggleReq,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post('/user/status', req, config);
}

/** 重置密码（POST /user/reset-pwd {userId}），返回一次性密码。 */
export function userResetPwd(
  req: { userId: number },
  config?: AxiosRequestConfig,
): Promise<OneTimePassword> {
  return kissenRequest.post<OneTimePassword>('/user/reset-pwd', req, config);
}

/** 分配角色（POST /user/assign-role，全量替换 roleIds）。 */
export function userAssignRole(
  req: UserAssignRoleReq,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post('/user/assign-role', req, config);
}

/** 强制下线（POST /user/force-logout/{userId}，所有会话立即失效）。 */
export function userForceLogout(
  userId: number,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post(`/user/force-logout/${userId}`, undefined, config);
}

/** 角色选项（源 loadRoles：POST /role/page，空筛选取前 200 条）。 */
export function getUserRoleOptions(
  config?: AxiosRequestConfig,
): Promise<PaginatedResponse<UserRoleOption>> {
  return kissenPage<UserRoleOption>('/role/page', {
    pageNum: 1,
    pageSize: 200,
  }, config);
}

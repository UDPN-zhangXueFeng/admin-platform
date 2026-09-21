/**
 * LP 系统用户域 raw API 层（源 `src/api/user.ts` 1:1）。
 *
 * 路径经 lp-client baseURL 拼 /lp 前缀（POST /lp/user/*）。loginName 全局唯一、
 * lp_id 由后端按登录态注入，前端一律不传。
 */
import type { AxiosRequestConfig } from 'axios';
import type { PaginatedResponse } from '@myorg/shared/model';

import { lpPage, lpRequest } from '../lp-client';
import type { UserListReq } from '../types';
import type {
  OneTimePassword,
  UserAssignRoleReq,
  UserCreateReq,
  UserPageReq,
  UserRow,
  UserUpdateReq,
} from './user.model';

/** 用户分页列表（POST /lp/user/page，body { page, data: query }）。 */
export function getUserPage(
  req: UserPageReq,
  config?: AxiosRequestConfig,
): Promise<PaginatedResponse<UserRow>> {
  return lpPage<UserRow, UserListReq>(
    '/user/page',
    { pageNum: req.pageNum, pageSize: req.pageSize, filter: req.filter },
    config,
  );
}

/**
 * 新增用户（POST /lp/user/save）→ 返回一次性初始密码
 * （后端置 first_login=0，用户下次登录强制改密；页面需弹窗抄送）。
 */
export function saveUser(
  data: UserCreateReq,
  config?: AxiosRequestConfig,
): Promise<OneTimePassword> {
  return lpRequest.post<OneTimePassword>('/user/save', data, config);
}

/** 更新用户（POST /lp/user/update；loginName 不可改，后端不接收该字段）。 */
export function updateUser(
  data: UserUpdateReq,
  config?: AxiosRequestConfig,
): Promise<void> {
  return lpRequest.post('/user/update', data, config);
}

/** 启停用户（POST /lp/user/status；停自己/停最后管理员由后端 23_0008 拒绝）。 */
export function toggleUserStatus(
  userId: number,
  status: number,
  config?: AxiosRequestConfig,
): Promise<void> {
  return lpRequest.post('/user/status', { userId, status }, config);
}

/**
 * 重置密码（POST /lp/user/reset-pwd）→ 返回一次性密码
 * （后端置 first_login=0，用户下次登录强制改密；页面需弹窗抄送）。
 */
export function resetUserPwd(
  userId: number,
  config?: AxiosRequestConfig,
): Promise<OneTimePassword> {
  return lpRequest.post<OneTimePassword>('/user/reset-pwd', { userId }, config);
}

/** 分配角色（POST /lp/user/assign-role；下次请求即生效）。 */
export function assignUserRoles(
  data: UserAssignRoleReq,
  config?: AxiosRequestConfig,
): Promise<void> {
  return lpRequest.post('/user/assign-role', data, config);
}

/** 强制下线（POST /lp/user/force-logout/{userId}，其所有会话立即失效）。 */
export function forceLogoutUser(
  userId: number,
  config?: AxiosRequestConfig,
): Promise<void> {
  return lpRequest.post(`/user/force-logout/${userId}`, undefined, config);
}

/**
 * User 模块 raw API 层（user.md §3）。
 *
 * 全部为 RBAC POST（base `/api/rbac/v1`），对齐 td-manage sys/user 真实后端。
 * 删除旧脚手架的 RESTful `/users`（GET/PATCH/DELETE）占位。
 */

import {
  apiClient,
  getRbacPaginated,
  type ApiRequestConfig,
} from '@myorg/shared/data-access-api';
import type { PaginatedResponse } from '@myorg/shared/model';
import type {
  RoleOption,
  TdOption,
  UserIdReqVo,
  UserQueryParams,
  UserRespVo,
  UserSaveReqVo,
  UserStatusUpdateReqVo,
  UserUpdateReqVo,
} from './user.model';

const BASE = '/api/rbac/v1';

/**
 * 后端单实体操作统一返回体（`ResultInfo`）。data 通常为 null。
 *
 * 注意：`apiClient.post` 仅在 `data === undefined` 时抛错；`null` 会原样返回，
 * 故这里返回类型显式标注 `ResultInfo`，调用方不依赖 data。
 */
export interface ResultInfo {
  code: number;
  data: unknown;
  message: string;
}

/**
 * 用户分页列表。对应旧页 useCustomTable 的 `url: '/user/listPage'`。
 * user.md 3.1：POST + `{ page: { pageNum, pageSize }, data: { userName?, email? } }`。
 */
export function getUserList(
  params: UserQueryParams,
  config?: ApiRequestConfig
): Promise<PaginatedResponse<UserRespVo>> {
  return getRbacPaginated<UserRespVo, UserQueryParams>(
    `${BASE}/user/listPage`,
    params,
    config
  );
}

/**
 * 用户详情 / 编辑回填。对应旧页 getSysUserInfoApi。
 * user.md 3.2/3.3：POST + `{ userId }`。
 */
export function getUserDetail(
  userId: number,
  config?: ApiRequestConfig
): Promise<UserRespVo> {
  return apiClient.post<UserRespVo>(`${BASE}/user/detail`, { userId }, config);
}

/** 创建用户。对应旧页 saveSysUserApi（user.md §3.3）。 */
export function saveUser(
  data: UserSaveReqVo,
  config?: ApiRequestConfig
): Promise<ResultInfo> {
  return apiClient.post<ResultInfo>(`${BASE}/user/save`, data, config);
}

/** 更新用户。对应旧页 updateSysUserApi（user.md §3.3）。 */
export function updateUser(
  data: UserUpdateReqVo,
  config?: ApiRequestConfig
): Promise<ResultInfo> {
  return apiClient.post<ResultInfo>(`${BASE}/user/update`, data, config);
}

/**
 * 启用/禁用用户。对应旧页 updateSysUserStatusApi（user.md §3.1）。
 * status：0 启用 / 1 禁用。
 */
export function updateUserStatus(
  data: UserStatusUpdateReqVo,
  config?: ApiRequestConfig
): Promise<ResultInfo> {
  return apiClient.post<ResultInfo>(`${BASE}/user/status/update`, data, config);
}

/** 重置密码。对应旧页 resetSysUserPasswordApi（user.md §3.1）。 */
export function resetUserPassword(
  userId: number,
  config?: ApiRequestConfig
): Promise<ResultInfo> {
  return apiClient.post<ResultInfo>(
    `${BASE}/user/password/reset`,
    { userId } satisfies UserIdReqVo,
    config
  );
}

/** 删除用户。对应旧页 deleteSysUserInfoApi（user.md §3.1）。 */
export function deleteUser(
  userId: number,
  config?: ApiRequestConfig
): Promise<ResultInfo> {
  return apiClient.post<ResultInfo>(
    `${BASE}/user/delete`,
    { userId } satisfies UserIdReqVo,
    config
  );
}

/**
 * 角色选项（跨模块依赖 role，user.md §3.2/§6）。
 * POST `/sys/role/list`，body 为空对象 `{}`，返回 `RoleOption[]`。
 */
export function getRoleOptions(
  config?: ApiRequestConfig
): Promise<RoleOption[]> {
  return apiClient.post<RoleOption[]>(`${BASE}/sys/role/list`, {}, config);
}

/**
 * TD（稳定币/链）选项（user.md §3.2）。
 * POST `/user/td/list`，body 为空对象 `{}`，返回 `TdOption[]`。
 */
export function getTdOptions(
  config?: ApiRequestConfig
): Promise<TdOption[]> {
  return apiClient.post<TdOption[]>(`${BASE}/user/td/list`, {}, config);
}

/**
 * 角色域 raw API 层（源 `api/role.ts`，端点与请求体 1:1）。
 */
import type { AxiosRequestConfig } from 'axios';
import type { PaginatedResponse } from '@myorg/shared/model';

import { kissenPage, kissenRequest } from '../kissen-gateway-client';
import type {
  RoleAssignMenuReq,
  RoleDetail,
  RoleListReq,
  RolePageReq,
  RoleRow,
  RoleSaveReq,
  RoleUpdateReq,
} from './role.model';

/** 角色分页列表（POST /role/page，`{page:{pageNum,pageSize}, data:{filter}}`）。 */
export function getRolePage(
  req: RolePageReq,
  config?: AxiosRequestConfig,
): Promise<PaginatedResponse<RoleRow>> {
  return kissenPage<RoleRow, RoleListReq>(
    '/role/page',
    { pageNum: req.pageNum, pageSize: req.pageSize, filter: req.filter },
    config,
  );
}

/** 角色详情（GET /role/detail/:roleId；含已分配 menuIds）。 */
export function getRoleDetail(
  roleId: number,
  config?: AxiosRequestConfig,
): Promise<RoleDetail> {
  return kissenRequest.get<RoleDetail>(`/role/detail/${roleId}`, config);
}

/** 角色已勾选菜单 ID（GET /role/menuIds/:roleId；分配弹窗回显用）。 */
export function getRoleMenuIds(
  roleId: number,
  config?: AxiosRequestConfig,
): Promise<number[]> {
  return kissenRequest.get<number[]>(`/role/menuIds/${roleId}`, config);
}

/** 新建角色（POST /role/save；roleCode 唯一）。 */
export function saveRole(
  data: RoleSaveReq,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post('/role/save', data, config);
}

/** 编辑角色（POST /role/update）。 */
export function updateRole(
  data: RoleUpdateReq,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post('/role/update', data, config);
}

/** 删除角色（POST /role/delete/:roleId；被用户引用时后端拒绝）。 */
export function removeRole(
  roleId: number,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post(`/role/delete/${roleId}`, undefined, config);
}

/** 分配菜单（POST /role/assign-menu；请求体 {roleId, menuIds}）。 */
export function assignRoleMenu(
  data: RoleAssignMenuReq,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post('/role/assign-menu', data, config);
}

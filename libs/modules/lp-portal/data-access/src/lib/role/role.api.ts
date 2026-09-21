/**
 * LP 系统角色域 raw API 层（源 `src/api/role.ts` 1:1）。
 *
 * 路径经 lp-client baseURL 拼 /lp 前缀（POST /lp/role/*；menuIds 为 GET）。
 * roleCode 全局唯一（冲突 23_0005）、role_type 后端固定 1 自定义。
 */
import type { AxiosRequestConfig } from 'axios';
import type { PaginatedResponse } from '@myorg/shared/model';

import { lpPage, lpRequest } from '../lp-client';
import type { RoleListReq } from '../types';
import type {
  RoleAssignMenuReq,
  RolePageReq,
  RoleRow,
  RoleSaveReq,
  RoleUpdateReq,
} from './role.model';

/** 角色分页列表（POST /lp/role/page，body { page, data: query }）。 */
export function getRolePage(
  req: RolePageReq,
  config?: AxiosRequestConfig,
): Promise<PaginatedResponse<RoleRow>> {
  return lpPage<RoleRow, RoleListReq>(
    '/role/page',
    { pageNum: req.pageNum, pageSize: req.pageSize, filter: req.filter },
    config,
  );
}

/** 新增角色（POST /lp/role/save；roleCode 重复 23_0005 由后端拒绝）。 */
export function saveRole(
  data: RoleSaveReq,
  config?: AxiosRequestConfig,
): Promise<void> {
  return lpRequest.post('/role/save', data, config);
}

/** 更新角色（POST /lp/role/update；roleCode 不可改，后端不接收该字段）。 */
export function updateRole(
  data: RoleUpdateReq,
  config?: AxiosRequestConfig,
): Promise<void> {
  return lpRequest.post('/role/update', data, config);
}

/**
 * 删除角色（POST /lp/role/delete/{roleId}）。
 * 内置角色（23_0007）与被用户引用角色（23_0006）由后端拒绝、拦截器展示。
 */
export function removeRole(
  roleId: number,
  config?: AxiosRequestConfig,
): Promise<void> {
  return lpRequest.post(`/role/delete/${roleId}`, undefined, config);
}

/**
 * 分配菜单（POST /lp/role/assign-menu；后端事务先删后插，空数组 = 清空授权）。
 * menuIds 由页面按「勾选 + 半选父」合并去重产出（见 assign-menu 回显/保存语义）。
 */
export function assignRoleMenus(
  data: RoleAssignMenuReq,
  config?: AxiosRequestConfig,
): Promise<void> {
  return lpRequest.post('/role/assign-menu', data, config);
}

/** 角色已分配菜单全量 menuId（GET /lp/role/menuIds/{roleId}；回显用，叶子过滤在前端）。 */
export function getRoleMenuIds(
  roleId: number,
  config?: AxiosRequestConfig,
): Promise<number[]> {
  return lpRequest.get(`/role/menuIds/${roleId}`, config);
}

/** 源 user 页 loadRoles 固定 pageSize:200（一次拉足，取舍见 role.queries 头注释）。 */
export const ROLE_OPTIONS_PAGE_SIZE = 200;

/**
 * 角色选项全量拉取（POST /lp/role/page，pageNum:1 + pageSize:200 + 空条件）。
 * user 页专用（源 `views/system/user/index.vue` loadRoles）。
 */
export function getRoleOptionsPage(
  config?: AxiosRequestConfig,
): Promise<PaginatedResponse<RoleRow>> {
  return lpPage<RoleRow>(
    '/role/page',
    { pageNum: 1, pageSize: ROLE_OPTIONS_PAGE_SIZE, filter: {} },
    config,
  );
}

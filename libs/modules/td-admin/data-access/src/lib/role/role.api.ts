import {
  apiClient,
  getRbacPaginated,
  type ApiRequestConfig,
} from '@myorg/shared/data-access-api';
import type { PaginatedResponse } from '@myorg/shared/model';
import type {
  RoleDetail,
  RoleInsertReq,
  RoleItem,
  RoleQueryParams,
  RoleStatusUpdateReq,
  RoleUpdateReq,
  MenuTreeNode,
} from './role.model';

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
 * 角色分页列表。对应旧页 useCustomTable 的 `url: '/sys/role/listPage'`。
 * role.md 3.1：POST + `{ page: { pageNum, pageSize }, data: { roleName? } }`。
 */
export function getRoleList(
  params: RoleQueryParams,
  config?: ApiRequestConfig
): Promise<PaginatedResponse<RoleItem>> {
  return getRbacPaginated<RoleItem, RoleQueryParams>(
    `${BASE}/sys/role/listPage`,
    params,
    config
  );
}

/**
 * 角色详情（含已授权 menuIdList）。对应旧页 getSysRoleInfoApi / useSWR 的 getRole。
 * role.md 3.3：POST + `{ roleId }`。
 */
export function getRole(
  roleId: number,
  config?: ApiRequestConfig
): Promise<RoleDetail> {
  return apiClient.post<RoleDetail>(`${BASE}/sys/role/getRole`, { roleId }, config);
}

/**
 * 全量菜单树（用于详情/编辑页授权树渲染）。对应旧页 useSWR 的 queryAllMenu。
 * role.md 3.2 / 7.5：POST，body 为空对象 `{}`。
 */
export function getAllMenus(
  config?: ApiRequestConfig
): Promise<MenuTreeNode[]> {
  return apiClient.post<MenuTreeNode[]>(`${BASE}/sys/menu/queryAllMenu`, {}, config);
}

/** 新建角色。对应旧页 saveRoleInfoApi。 */
export function saveRole(
  data: RoleInsertReq,
  config?: ApiRequestConfig
): Promise<ResultInfo> {
  return apiClient.post<ResultInfo>(`${BASE}/sys/role/save`, data, config);
}

/** 更新角色。对应旧页 updateRoleInfoApi。 */
export function updateRole(
  data: RoleUpdateReq,
  config?: ApiRequestConfig
): Promise<ResultInfo> {
  return apiClient.post<ResultInfo>(`${BASE}/sys/role/update`, data, config);
}

/**
 * 启用/禁用角色。对应旧页 updateRoleStatusApi。
 * status：0 启用 / 1 禁用（role.md 7.4）。
 */
export function updateRoleStatus(
  data: RoleStatusUpdateReq,
  config?: ApiRequestConfig
): Promise<ResultInfo> {
  return apiClient.post<ResultInfo>(`${BASE}/sys/role/status/update`, data, config);
}

/** 删除角色。对应旧页 deleteRoleInfoApi。 */
export function deleteRole(
  roleId: number,
  config?: ApiRequestConfig
): Promise<ResultInfo> {
  return apiClient.post<ResultInfo>(`${BASE}/sys/role/delete`, { roleId }, config);
}

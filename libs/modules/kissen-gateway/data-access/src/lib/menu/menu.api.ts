'use client';

import type { AxiosRequestConfig } from 'axios';

import { kissenRequest } from '../kissen-gateway-client';
import type {
  MenuPermissionRow,
  MenuPermissionSaveReq,
  MenuSaveReq,
  MenuTree,
  MenuUpdateReq,
} from './menu.model';

/**
 * 菜单树。
 * 注：后端 MenuController 为 GET /menu/tree（与设计文档的 POST 不一致，以实际后端为准）。
 */
export function getMenuTree(config?: AxiosRequestConfig): Promise<MenuTree[]> {
  return kissenRequest.get<MenuTree[]>('/menu/tree', config);
}

export function saveMenu(data: MenuSaveReq): Promise<void> {
  return kissenRequest.post('/menu/save', data);
}

export function updateMenu(data: MenuUpdateReq): Promise<void> {
  return kissenRequest.post('/menu/update', data);
}

export function removeMenu(menuId: number): Promise<void> {
  return kissenRequest.post(`/menu/delete/${menuId}`);
}

export function getMenuPermissionList(
  data?: { menuKey?: string },
  config?: AxiosRequestConfig,
): Promise<MenuPermissionRow[]> {
  return kissenRequest.post<MenuPermissionRow[]>(
    '/menu/menu-permission/list',
    data,
    config,
  );
}

export function saveMenuPermission(data: MenuPermissionSaveReq): Promise<void> {
  return kissenRequest.post('/menu/menu-permission/save', data);
}

/** 移除接口权限（POST /menu/menu-permission/delete/:menuPermissionId）。 */
export function deleteMenuPermission(menuPermissionId: number): Promise<void> {
  return kissenRequest.post(`/menu/menu-permission/delete/${menuPermissionId}`);
}

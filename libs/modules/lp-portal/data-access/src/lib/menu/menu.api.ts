/**
 * LP 系统菜单域 raw API 层（源 `src/api/menu.ts` + `src/api/menu-permission.ts` 1:1）。
 *
 * - 菜单树为 **GET** /lp/menu/tree（LP 后端 @GetMapping；与 admin 侧 POST 先例
 *   不同，以 LP 后端为准——勿改成 POST）。
 * - menu-permission 为独立 Controller（POST /lp/menu-permission/*），源同文件
 *   消费，故随菜单域落位（R3 role 页的菜单分配树消费 GET /role/menuIds，
 *   不在此处）。
 */
import type { AxiosRequestConfig } from 'axios';

import { lpRequest } from '../lp-client';
import type {
  MenuPermissionItem,
  MenuPermissionRow,
  MenuPermissionSaveReq,
  MenuSaveReq,
  MenuTree,
  MenuUpdateReq,
} from './menu.model';

/** 菜单树（GET /lp/menu/tree）。 */
export function getMenuTree(config?: AxiosRequestConfig): Promise<MenuTree[]> {
  return lpRequest.get('/menu/tree', config);
}

/** 新增菜单（POST /lp/menu/save；menuKey 全局唯一，冲突 23_0021）。 */
export function saveMenu(
  data: MenuSaveReq,
  config?: AxiosRequestConfig,
): Promise<void> {
  return lpRequest.post('/menu/save', data, config);
}

/** 更新菜单（POST /lp/menu/update；menuKey/menuType/parentId 后端不接收）。 */
export function updateMenu(
  data: MenuUpdateReq,
  config?: AxiosRequestConfig,
): Promise<void> {
  return lpRequest.post('/menu/update', data, config);
}

/** 删除菜单（POST /lp/menu/delete/{menuId}；有子菜单 23_0009/被角色引用 23_0010 由后端拒绝）。 */
export function removeMenu(
  menuId: number,
  config?: AxiosRequestConfig,
): Promise<void> {
  return lpRequest.post(`/menu/delete/${menuId}`, undefined, config);
}

/**
 * 接口权限列表（POST /lp/menu-permission/list，按 menuId/menuKey 查询均可选）。
 * 后端 MenuPermissionRespVO → 前端 MenuPermissionItem 映射（源 api 同款）：
 * menuPermissionId→id、resourceUrl→url；无 id = 本地新增未保存行。
 */
export async function getMenuPermissionList(
  data: { menuId?: number; menuKey?: string },
  config?: AxiosRequestConfig,
): Promise<MenuPermissionItem[]> {
  const rows = await lpRequest.post<MenuPermissionRow[]>(
    '/menu-permission/list',
    data,
    config,
  );
  return rows.map((r) => ({
    id: r.menuPermissionId,
    menuKey: r.menuKey,
    url: r.resourceUrl,
    httpMethod: r.httpMethod,
  }));
}

/**
 * 保存接口权限（POST /lp/menu-permission/save，逐行写入）。
 * 后端仅 insert 无删除端点——「删除已保存行」源语义为不支持（页面明示）。
 */
export function saveMenuPermission(
  data: MenuPermissionSaveReq,
  config?: AxiosRequestConfig,
): Promise<void> {
  return lpRequest.post('/menu-permission/save', data, config);
}

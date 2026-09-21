/**
 * RBAC 域 raw API 层（用户 / 角色 / 菜单），忠实移植源 `api/rbac.ts`。
 *
 * 路径前缀 `/rbac/*`，由 kissen-client 的 `/v1` baseURL 拼成 `/v1/rbac/*`。
 * 分页列表统一走 {@link kissenPage}，单实体操作走 {@link kissenRequest}。
 */
import type { AxiosRequestConfig } from 'axios';
import type { PaginatedResponse } from '@myorg/shared/model';

import { kissenPage, kissenRequest } from '../kissen-client';
import type { ChangePwdReq, LoginReq, LoginRespVO, MenuTreeRespVO } from '../auth.model';
import type {
  MenuPermissionItem,
  MenuPermissionRow,
  MenuSaveReq,
  MenuUpdateReq,
  OneTimePassword,
  RoleAssignMenuReq,
  RoleListReq,
  RoleRow,
  RoleSaveReq,
  RoleUpdateReq,
  UserAssignRoleReq,
  UserCreateReq,
  UserListReq,
  UserRow,
  UserToggleReq,
  UserUpdateReq,
} from './rbac.model';

// ------------------------------ 认证 ------------------------------

/** 登录（源 login：POST /rbac/login）。 */
export function userLogin(
  req: LoginReq,
  config?: AxiosRequestConfig,
): Promise<LoginRespVO> {
  return kissenRequest.post<LoginRespVO>('/rbac/login', req, config);
}

/** 登出（源 logout：POST /rbac/logout）。 */
export function userLogout(config?: AxiosRequestConfig): Promise<void> {
  return kissenRequest.post('/rbac/logout', undefined, config);
}

// ------------------------------ 用户 ------------------------------

/** 用户分页列表（源 userPage：POST /rbac/user/page）。 */
export function getUserPage(
  req: { pageNum: number; pageSize: number; filter: UserListReq },
  config?: AxiosRequestConfig,
): Promise<PaginatedResponse<UserRow>> {
  return kissenPage<UserRow, UserListReq>(
    '/rbac/user/page',
    { pageNum: req.pageNum, pageSize: req.pageSize, filter: req.filter },
    config,
  );
}

/** 创建用户（源 userSave：POST /rbac/user/save），返回一次性密码。 */
export function userSave(
  req: UserCreateReq,
  config?: AxiosRequestConfig,
): Promise<OneTimePassword> {
  return kissenRequest.post<OneTimePassword>('/rbac/user/save', req, config);
}

/** 更新用户（源 userUpdate：POST /rbac/user/update）。 */
export function userUpdate(
  req: UserUpdateReq,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post('/rbac/user/update', req, config);
}

/** 启停用户（源 userStatus：POST /rbac/user/status）。0 正常 / 1 停用。 */
export function userStatus(
  req: UserToggleReq,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post('/rbac/user/status', req, config);
}

/** 重置密码（源 userResetPwd：POST /rbac/user/reset-pwd），返回一次性密码。 */
export function userResetPwd(
  req: { userId: number },
  config?: AxiosRequestConfig,
): Promise<OneTimePassword> {
  return kissenRequest.post<OneTimePassword>(
    '/rbac/user/reset-pwd',
    req,
    config,
  );
}

/** 分配角色（源 userAssignRole：POST /rbac/user/assign-role）。 */
export function userAssignRole(
  req: UserAssignRoleReq,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post('/rbac/user/assign-role', req, config);
}

/** 强制下线（源 userForceLogout：POST /rbac/user/force-logout/{userId}）。 */
export function userForceLogout(
  userId: number,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post(
    `/rbac/user/force-logout/${userId}`,
    undefined,
    config,
  );
}


/** 自助修改密码（源 userChangePwd：POST /rbac/user/change-pwd）。 */
export function userChangePwd(
  req: ChangePwdReq,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post('/rbac/user/change-pwd', req, config);
}

// ------------------------------ 角色 ------------------------------

/** 角色分页列表（源 rolePage：POST /rbac/role/page）。 */
export function getRolePage(
  req: { pageNum: number; pageSize: number; filter: RoleListReq },
  config?: AxiosRequestConfig,
): Promise<PaginatedResponse<RoleRow>> {
  return kissenPage<RoleRow, RoleListReq>(
    '/rbac/role/page',
    { pageNum: req.pageNum, pageSize: req.pageSize, filter: req.filter },
    config,
  );
}

/** 新建角色（源 roleSave：POST /rbac/role/save）。 */
export function roleSave(
  req: RoleSaveReq,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post('/rbac/role/save', req, config);
}

/** 更新角色（源 roleUpdate：POST /rbac/role/update）。 */
export function roleUpdate(
  req: RoleUpdateReq,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post('/rbac/role/update', req, config);
}

/** 删除角色（源 roleDelete：POST /rbac/role/delete/{roleId}）。 */
export function roleDelete(
  roleId: number,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post(`/rbac/role/delete/${roleId}`, undefined, config);
}

/** 分配菜单（源 roleAssignMenu：POST /rbac/role/assign-menu）。 */
export function roleAssignMenu(
  req: RoleAssignMenuReq,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post('/rbac/role/assign-menu', req, config);
}

/**
 * 角色已分配菜单全量 menuId（源 roleMenuIds：GET /rbac/role/menuIds/{roleId}）。
 * 回显用；叶子过滤在前端（check-strictly=false 下回显父键会级联误勾）。
 */
export function roleMenuIds(
  roleId: number,
  config?: AxiosRequestConfig,
): Promise<number[]> {
  return kissenRequest.get<number[]>(`/rbac/role/menuIds/${roleId}`, config);
}

// ------------------------------ 菜单 ------------------------------

/** 菜单树（源 menuTree：POST /rbac/menu/tree）。 */
export function menuTree(
  config?: AxiosRequestConfig,
): Promise<MenuTreeRespVO[]> {
  return kissenRequest.post<MenuTreeRespVO[]>(
    '/rbac/menu/tree',
    undefined,
    config,
  );
}

/** 新建菜单（源 menuSave：POST /rbac/menu/save）。 */
export function menuSave(
  req: MenuSaveReq,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post('/rbac/menu/save', req, config);
}

/** 更新菜单（源 menuUpdate：POST /rbac/menu/update）。 */
export function menuUpdate(
  req: MenuUpdateReq,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post('/rbac/menu/update', req, config);
}

/** 删除菜单（源 menuDelete：POST /rbac/menu/delete/{menuId}）。 */
export function menuDelete(
  menuId: number,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post(`/rbac/menu/delete/${menuId}`, undefined, config);
}

/**
 * 菜单接口权限列表（源 menuPermList：POST /rbac/menu-permission/list）。
 * 后端 MenuPermissionRespVO 映射为前端 MenuPermissionItem（resourceUrl→url）。
 */
export async function menuPermList(
  req: { menuKey: string },
  config?: AxiosRequestConfig,
): Promise<MenuPermissionItem[]> {
  const rows = await kissenRequest.post<MenuPermissionRow[]>(
    '/rbac/menu-permission/list',
    req,
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
 * 保存菜单接口权限（源 menuPermSave：POST /rbac/menu-permission/save）。
 * 后端 MenuPermissionSaveReqVO 全量替换。
 */
export function menuPermSave(
  req: { menuKey: string; items: MenuPermissionItem[] },
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post(
    '/rbac/menu-permission/save',
    {
      menuKey: req.menuKey,
      permissions: req.items.map((i) => ({
        resourceUrl: i.url,
        httpMethod: i.httpMethod,
      })),
    },
    config,
  );
}

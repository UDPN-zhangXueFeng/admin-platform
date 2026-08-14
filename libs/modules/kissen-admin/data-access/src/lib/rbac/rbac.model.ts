/**
 * RBAC 域数据模型（用户 / 角色 / 菜单），字段对齐 kissen 源 `types/system.ts`。
 *
 * 注意：`MenuTreeRespVO` 已由 `lib/auth.model.ts`（foundation）导出且与源 auth.ts 一致，
 * 本文件不再重复定义，api 层直接 `import type` 复用，避免 barrel 重名冲突。
 */

// ------------------------------ 用户 ------------------------------

export interface UserListReq {
  loginName?: string;
  userName?: string;
  roleId?: number;
  status?: number;
}

/** 用户列表行（源 UserRow），rowKey 为 `userId`。 */
export interface UserRow {
  userId: number;
  loginName: string;
  userName: string;
  /** 0 超级管理员 / 1 运营用户 */
  userType: number;
  email?: string;
  phoneNumber?: string;
  /** 0 正常 / 1 停用 */
  status: number;
  /** 0 待改密（首登） / 1 已改密 */
  firstLogin: number;
  createTime: number;
  roleIds?: number[];
}

/** 创建用户请求体（源 UserCreateReq）。 */
export interface UserCreateReq {
  loginName: string;
  userName: string;
  userType?: number;
  email?: string;
  phoneNumber?: string;
  roleIds?: number[];
}

/** 更新用户请求体（源 UserUpdateReq）。 */
export interface UserUpdateReq {
  userId: number;
  userName?: string;
  email?: string;
  phoneNumber?: string;
  /** null=不改角色；空数组=清空 */
  roleIds?: number[] | null;
}

/** 启停用户请求体（源 UserToggleReq）。0 正常 / 1 停用。 */
export interface UserToggleReq {
  userId: number;
  status: number;
}

/** 分配角色请求体（源 UserAssignRoleReq）。 */
export interface UserAssignRoleReq {
  userId: number;
  roleIds: number[];
}

/** 创建/重置密码返回的一次性密码（源 OneTimePassword）。 */
export interface OneTimePassword {
  userId: number;
  oneTimePassword: string;
}

// ------------------------------ 角色 ------------------------------

export interface RoleListReq {
  roleCode?: string;
  roleName?: string;
}

/** 角色列表行（源 RoleRow），rowKey 为 `roleId`。 */
export interface RoleRow {
  roleId: number;
  roleCode: string;
  roleName: string;
  /** 0 内置 / 1 自定义（后端 RoleRespVO.roleType） */
  roleType?: number;
  sort?: number;
  remarks?: string;
  /** 0 正常 / 1 停用 */
  status: number;
  createTime: number;
}

/** 新建角色请求体（源 RoleSaveReq）。创建时一并分配菜单（menuIds）。 */
export interface RoleSaveReq {
  roleCode: string;
  roleName: string;
  /** 后端 RoleSaveReqVO 无此字段，多余被 Jackson 忽略；UI 排序用。 */
  sort?: number;
  remarks?: string;
  menuIds?: number[];
}

/** 更新角色请求体（源 RoleUpdateReq）。 */
export interface RoleUpdateReq {
  roleId: number;
  roleName?: string;
  remarks?: string;
  status?: number;
  /** null=不改菜单；列表=全量替换 */
  menuIds?: number[] | null;
}

/** 分配菜单请求体（源 RoleAssignMenuReq）。 */
export interface RoleAssignMenuReq {
  roleId: number;
  menuIds: number[];
}

// ------------------------------ 菜单 ------------------------------

/** 新建菜单请求体（源 MenuSaveReq）。 */
export interface MenuSaveReq {
  menuName: string;
  menuNameEn?: string;
  menuKey: string;
  parentId?: number;
  /** 0 模块 / 1 系统 / 2 一级菜单 / 3 二级菜单 / 4 按钮 */
  menuType: number;
  orderNum?: number;
  visible?: number;
  menuUrl?: string;
  icon?: string;
}

/** 更新菜单请求体（源 MenuUpdateReq）。 */
export interface MenuUpdateReq extends MenuSaveReq {
  menuId: number;
}

/** 菜单接口权限项（前端视图，源 MenuPermissionItem）。 */
export interface MenuPermissionItem {
  id?: number;
  menuKey: string;
  url: string;
  httpMethod?: string;
}

/** 后端菜单接口权限行（源 MenuPermissionRow，menu-permission/list 返回结构）。 */
export interface MenuPermissionRow {
  menuPermissionId: number;
  menuId: number;
  menuKey: string;
  resourceUrl: string;
  httpMethod: string;
  resourceType: number;
  permissionType: number;
}

// ------------------------------ 状态枚举映射 ------------------------------

/** 用户状态：0 正常 / 1 停用（与角色 status 同编号空间）。 */
export const RBAC_USER_STATUS_LABEL: Record<number, string> = {
  0: '正常',
  1: '停用',
};

export const RBAC_USER_STATUS_VARIANT: Record<
  number,
  'default' | 'secondary'
> = {
  0: 'default',
  1: 'secondary',
};

/** 用户类型：0 超级管理员 / 1 运营用户。 */
export const RBAC_USER_TYPE_LABEL: Record<number, string> = {
  0: '超管',
  1: '运营',
};

export const RBAC_USER_TYPE_VARIANT: Record<
  number,
  'destructive' | 'default'
> = {
  0: 'destructive',
  1: 'default',
};

/** 首登状态：0 待改密 / 1 已改密。 */
export const RBAC_FIRST_LOGIN_LABEL: Record<number, string> = {
  0: '待改密',
  1: '已改密',
};

export const RBAC_FIRST_LOGIN_VARIANT: Record<
  number,
  'secondary' | 'default'
> = {
  0: 'secondary',
  1: 'default',
};

/** 菜单类型：0 模块 / 1 系统 / 2 一级菜单 / 3 二级菜单 / 4 按钮。 */
export const MENU_TYPE_LABEL: Record<number, string> = {
  0: '模块',
  1: '系统',
  2: '一级菜单',
  3: '二级菜单',
  4: '按钮',
};

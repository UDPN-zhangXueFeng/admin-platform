/**
 * 角色域模型（源 `types/system.ts` Role 系列 + `views/system/role.vue` 标签三元）。
 *
 * 字段与源逐字段对齐；展示语义（内置/自定义、正常/停用）跟随源模板三元，
 * 不引入源不存在的「未知码」兜底。
 */

/** Badge variant 约定（Element tag type 映射：danger→destructive、primary→secondary、success→default、info→outline）。 */
export type RoleVariant = 'default' | 'secondary' | 'destructive' | 'outline';

/** 角色列表筛选（POST /role/page，全部可选）。 */
export interface RoleListReq {
  roleCode?: string;
  roleName?: string;
  status?: number;
}

/** 列表查询请求（喂 kissenPage）。 */
export interface RolePageReq {
  pageNum: number;
  pageSize: number;
  filter?: RoleListReq;
}

/** 角色行（gw_role；rowKey=roleId）。 */
export interface RoleRow {
  roleId: number;
  roleCode: string;
  roleName: string;
  /** 0 内置 / 1 自定义（后端 RoleRespVO.roleType）。 */
  roleType?: number;
  status: number;
  remarks?: string;
  createTime?: number;
}

/** 角色详情（GET /role/detail/:roleId；menuIds 仅详情接口填充）。 */
export interface RoleDetail extends RoleRow {
  menuIds?: number[];
}

/** 新建角色（POST /role/save；roleCode 唯一）。 */
export interface RoleSaveReq {
  roleCode: string;
  roleName?: string;
  remarks?: string;
}

/** 编辑角色（POST /role/update；源语义 roleCode 不可改不上送）。 */
export interface RoleUpdateReq {
  roleId: number;
  roleName?: string;
  remarks?: string;
}

/** 分配菜单（POST /role/assign-menu；源 assignMenu(roleId, menuIds) 请求体）。 */
export interface RoleAssignMenuReq {
  roleId: number;
  menuIds: number[];
}

/** 内置角色标识（roleType=0；源 role.vue onDelete 守卫：内置角色不可删除）。 */
export const ROLE_TYPE_BUILTIN = 0;

/** 状态筛选下拉选项（值沿用源状态枚举 0 正常 / 1 停用；value 字符串供 Select 使用）。 */
export const ROLE_STATUS_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '0', label: '正常' },
  { value: '1', label: '停用' },
];

/** 类型文案；源三元 1:1（0 内置 / 其余自定义）。 */
export function roleTypeText(roleType?: number): string {
  return roleType === ROLE_TYPE_BUILTIN ? '内置' : '自定义';
}

/** 类型 Badge variant；源 el-tag type 三元 1:1（内置 danger / 自定义 primary）。 */
export function roleTypeVariant(roleType?: number): RoleVariant {
  return roleType === ROLE_TYPE_BUILTIN ? 'destructive' : 'secondary';
}

/** 状态文案；源三元 1:1（0 正常 / 其余停用）。 */
export function roleStatusText(status?: number): string {
  return status === 0 ? '正常' : '停用';
}

/** 状态 Badge variant；源 el-tag type 三元 1:1（正常 success / 停用 info）。 */
export function roleStatusVariant(status?: number): RoleVariant {
  return status === 0 ? 'default' : 'outline';
}

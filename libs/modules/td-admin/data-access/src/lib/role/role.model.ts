import type { PaginationParams } from '@myorg/shared/model';

/**
 * Role 模块数据模型。字段对齐 td-manage RBAC OpenAPI 生成类型（role.md §4）。
 *
 * 状态枚举语义统一为：0 启用 / 1 禁用（role.md 7.4，三个 DTO 注释措辞不一但语义一致）。
 */

/**
 * 列表行（`SysRoleRespVo`，role.md 4.1）。rowKey 为 `roleId`。
 *
 * 注意：`roleType` 在 OpenAPI 模型中**未声明**，但旧页行操作 disabled 逻辑依赖它
 * （role.md 7.1：区分系统内置角色 0 vs 自定义角色）。后端实际返回该字段，前端需保留
 * 可选读取——行操作守卫读取时若为 undefined 则守卫不生效（恒可点），符合现状。
 */
export interface RoleItem {
  roleId: number;
  roleName: string;
  /** 0 启用 / 1 禁用。 */
  status: number;
  /** 角色描述标识（源码注释，类型 number，语义遗留）。列表场景未使用。 */
  describes?: number;
  remarks?: string;
  /** 列表场景未使用，仅详情/编辑页树用到。 */
  menuList?: MenuTreeNode[];
  /**
   * 角色类型。OpenAPI 未声明，后端实际返回；行操作守卫（disable/enable/delete/edit）
   * 依赖 `roleType !== 0` 判断是否系统内置角色。保留为可选（role.md 7.1）。
   */
  roleType?: number;
}

/**
 * 详情（`SysRoleByIdRespVo`，role.md 4.2）。编辑回填 + 详情只读共用。
 * `menuIdList` 是已授权菜单 ID 全集（含父节点），驱动 Tree checkedKeys。
 */
export interface RoleDetail {
  roleId: number;
  roleName: string;
  /** 0 启用 / 1 禁用。 */
  status: number;
  /** 已授权菜单 ID 列表（含父节点，渲染时需过滤为叶子）。 */
  menuIdList: number[];
  remarks: string;
  describes?: number;
}

/**
 * 菜单树节点（`MenuTreeRespVo`，role.md 4.3）。
 *
 * `menuName` 是 i18n key，前端再 `t()`；`children` 递归。供 view/edit 页菜单树渲染。
 */
export interface MenuTreeNode {
  menuId: number;
  menuName: string;
  menuCode?: string;
  menuKey?: string;
  /** 0 目录 / 1 菜单 / 2 按钮。 */
  menuType?: number;
  parentId?: number;
  orderNum?: number;
  icon?: string;
  /** 是否选中：1 是 / 2 否。 */
  selected?: number;
  orgType?: number;
  children?: MenuTreeNode[];
}

/** 列表查询参数（role.md 3.1，仅 roleName 单字段筛选 + 分页）。 */
export interface RoleQueryParams extends PaginationParams {
  roleName?: string;
}

/** 新建角色请求体（`RoleInsertReqVo`）。 */
export interface RoleInsertReq {
  roleName: string;
  /** 0 启用 / 1 禁用。 */
  status: number;
  menuIdList?: number[];
  remarks?: string;
}

/** 更新角色请求体（`RoleUpdateReqVo`）。 */
export interface RoleUpdateReq {
  roleId: number;
  roleName?: string;
  status?: number;
  menuIdList?: number[];
  remarks?: string;
}

/** 启用/禁用请求体（`RoleStatusUpdateReqVo`）。 */
export interface RoleStatusUpdateReq {
  roleId: number;
  /** 0 启用 / 1 禁用。 */
  status: number;
}

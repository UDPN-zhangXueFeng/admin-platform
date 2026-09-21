/**
 * User 模块数据模型。字段对齐 td-manage RBAC OpenAPI 生成类型（user.md §4）。
 *
 * 区别于旧脚手架：删除 `id:string` / `name` / `role`单值 / 字符串 status，
 * 改为 `userId:number` / `roleIds:number[]` / `tdIds:number[]` / `status:number`。
 */

import type { PaginationParams } from '@myorg/shared/model';

/**
 * 列表行 / 详情（`UserRespVo`，user.md §4.1）。rowKey 为 `userId`。
 *
 * 注意：`roleName` / `tdName` 是后端拼好的展示字符串（tdName 逗号分隔），
 * 列表页直接渲染；详情页则用 `roleIds` / `tdIds` 与角色/TD 列表交叉勾选回显。
 */
export interface UserRespVo {
  userId: number;
  userName: string;
  loginName: string;
  email: string;
  phoneNumber: string;
  /** 0 正常 / 1 禁用。 */
  status: number;
  roleIds: number[];
  roleName: string;
  tdIds: number[];
  tdName: string;
  createTime: number;
  updateTime: number;
}

/** 创建用户请求体（`UserSaveReqVo`，user.md §4.2）。 */
export interface UserSaveReqVo {
  userName: string;
  /** 创建时 = userName（user.md §5.3，旧页硬编码）。 */
  loginName: string;
  email: string;
  phoneNumber: string;
  roleIds: number[];
  tdIds: number[];
  /** 旧页提交时硬编码 orgId=1（user.md §4.2 注释）。 */
  orgId: number;
}

/** 更新用户请求体（`UserUpdateReqVo`，user.md §4.3）。 */
export interface UserUpdateReqVo {
  userId: number;
  userName: string;
  email: string;
  phoneNumber: string;
  roleIds: number[];
  tdIds: number[];
  orgId: number;
}

/** 启停用户请求体（`UserStatusUpdateReqVo`，user.md §4.4）。0 启用 / 1 禁用。 */
export interface UserStatusUpdateReqVo {
  userId: number;
  status: number;
}

/** 单用户请求体（`UserIdReqVo`，user.md §4.4：详情/重置密码/删除）。 */
export interface UserIdReqVo {
  userId: number;
}

/**
 * 跨模块角色选项（`SysRoleRespVo` 子集，user.md §4.5）。
 * `/sys/role/list` 返回；`roleType===0` 为管理员角色，触发 TD 全选联动。
 */
export interface RoleOption {
  roleId: number;
  roleName: string;
  /** 0 = 管理员角色（触发 TD 全选）。 */
  roleType: number;
  /** 1 = 禁用（该角色 checkbox 禁用）。 */
  status: number;
}

/**
 * 跨模块 TD（稳定币/链）选项（user.md §3.2）。
 * `/user/td/list` 返回；stablecoinId 为多选 value。
 */
export interface TdOption {
  stablecoinId: number;
  stablecoinName: string;
  blockchainName: string;
}

/** 列表查询参数（user.md §3.1，仅 userName/email 双字段筛选 + 分页）。 */
export interface UserQueryParams extends PaginationParams {
  userName?: string;
  email?: string;
}

/** User 模块筛选态（userName / email，user.md §5.1）。供 user-filter.store 使用。 */
export interface UserFilters {
  userName: string;
  email: string;
}

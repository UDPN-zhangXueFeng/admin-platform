/**
 * User 模块基础类型（util 层，可被 data-access / ui / feature 安全引用）。
 *
 * 对齐 td-manage sys/user 真实 RBAC 业务（user.md §4）。区别于旧脚手架：
 * - 不再有单值 `UserRole` 字符串枚举（改为 `roleIds: number[]` 多对多）。
 * - `UserStatus` 改为数字枚举（0 启用 / 1 禁用，对齐后端 status 字段）。
 */

/** 用户状态枚举：0 启用（正常）/ 1 禁用（user.md §4.1）。 */
export const UserStatus = {
  Enabled: 0,
  Disabled: 1,
} as const;

export type UserStatusValue = (typeof UserStatus)[keyof typeof UserStatus];

/**
 * 客户端筛选态。仅承载 userName / email 两个文本筛选（user.md §5.1，无角色/状态筛选）。
 * 字符串为空表示该筛选未启用。
 */
export interface UserFilters {
  userName: string;
  email: string;
}

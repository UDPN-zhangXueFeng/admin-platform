/**
 * User 模块常量。
 *
 * - `UserStatus`：状态枚举（0 enabled / 1 disabled，user.md §4.1）。
 *   re-export 自 user-types，供 feature/ui 经 util barrel 统一引用。
 * - `USER_PAGE_SIZE`：列表分页默认，对齐旧页 useCustomTable。
 */

export { UserStatus, type UserStatusValue } from './user-types';

/** 列表默认每页条数，对齐旧页 useCustomTable 的分页默认。 */
export const USER_PAGE_SIZE = 10;

/**
 * LP 系统用户域模型（源 `types/system.ts` 用户段 + `views/system/user/index.vue` 码表）。
 *
 * 行/请求 VO 集中定义在 `../types`（types.ts 为源 types/system.ts 的 1:1 平移，
 * barrel 已 star 导出），域内仅重导出同一声明——不重复定义，避免 pool 域曾出现的
 * 双声明同名歧义（见 data-access index.ts 顶部注释）。
 */
import type { UserListReq } from '../types';

export type {
  UserListReq,
  UserRow,
  UserCreateReq,
  UserUpdateReq,
  UserAssignRoleReq,
  OneTimePassword,
} from '../types';

/** 用户页分页列表入参（hook 消费形状，对齐 topup 域 TopupListReq 先例）。 */
export interface UserPageReq {
  pageNum: number;
  pageSize: number;
  filter?: UserListReq;
}

/** 用户状态文案（源状态 tag：0 正常 / 1 停用；未知码由页面显原值）。 */
export const USER_STATUS_TEXT: Record<number, string> = {
  0: 'Normal',
  1: 'Disabled',
};

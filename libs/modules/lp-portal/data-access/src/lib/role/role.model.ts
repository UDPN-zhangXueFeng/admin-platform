/**
 * LP 系统角色域模型（源 `types/system.ts` 角色段 + `views/system/role/index.vue` 码表）。
 *
 * 行/请求 VO 集中定义在 `../types`（源 1:1 平移，barrel 已 star 导出），
 * 此处仅重导出同一声明，不重复定义（避免 pool 域曾出现的同名歧义）。
 */
import type { RoleListReq } from '../types';

export type {
  RoleListReq,
  RoleRow,
  RoleSaveReq,
  RoleUpdateReq,
  RoleAssignMenuReq,
} from '../types';

/** 角色页分页列表入参（hook 消费形状，对齐 user 域 UserPageReq 先例）。 */
export interface RolePageReq {
  pageNum: number;
  pageSize: number;
  filter?: RoleListReq;
}

/** 角色类型文案（源 tag：0 内置 danger / 1 自定义 primary；未知码页面显原值）。 */
export const ROLE_TYPE_TEXT: Record<number, string> = {
  0: '内置',
  1: '自定义',
};

/** 角色状态文案（源 tag：0 正常 success / 1 停用 info）。 */
export const ROLE_STATUS_TEXT: Record<number, string> = {
  0: '正常',
  1: '停用',
};

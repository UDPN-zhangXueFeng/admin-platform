/**
 * TanStack Query key factory for the user module.
 *
 * 所有 key 携带 `projectId`，切换项目自动隔离缓存。user 含 list / detail /
 * roleOptions / tdOptions 四类（role/TD 为表单/详情页共用数据源）。
 */

import type { UserQueryParams } from '../user.model';

export const userKeys = {
  /** 模块根 key。 */
  all: (projectId: string) => ['project', projectId, 'user'] as const,

  /** list 查询前缀（mutations 成功后统一 invalidate）。 */
  lists: (projectId: string) => [...userKeys.all(projectId), 'list'] as const,

  /** 某组筛选/分页参数下的 list key。 */
  list: (projectId: string, params: UserQueryParams) =>
    [...userKeys.lists(projectId), params] as const,

  /** 单个用户详情 key。 */
  detail: (projectId: string, userId: number) =>
    [...userKeys.all(projectId), 'detail', userId] as const,

  /** 角色选项 key（表单/详情页共用，跨模块 role 列表）。 */
  roleOptions: (projectId: string) =>
    [...userKeys.all(projectId), 'roleOptions'] as const,

  /** TD 选项 key（表单/详情页共用，user 独占 td 列表）。 */
  tdOptions: (projectId: string) =>
    [...userKeys.all(projectId), 'tdOptions'] as const,
} as const;

import type { RoleQueryParams } from '../role.model';

/**
 * TanStack Query key factory for the role module.
 *
 * 所有 key 携带 `projectId`，切换项目自动隔离缓存。role 含 list / detail / menus 三类。
 */
export const roleKeys = {
  /** 模块根 key。 */
  all: (projectId: string) => ['project', projectId, 'role'] as const,

  /** list 查询前缀（mutations 成功后统一 invalidate）。 */
  lists: (projectId: string) => [...roleKeys.all(projectId), 'list'] as const,

  /** 某组筛选/分页参数下的 list key。 */
  list: (projectId: string, params: RoleQueryParams) =>
    [...roleKeys.lists(projectId), params] as const,

  /** 单个角色详情 key。 */
  detail: (projectId: string, roleId: number) =>
    [...roleKeys.all(projectId), 'detail', roleId] as const,

  /** 全量菜单树 key（编辑/详情页共用数据源）。 */
  menus: (projectId: string) => [...roleKeys.all(projectId), 'menus'] as const,
} as const;

import type { SysLogQueryParams } from '../syslog.model';

/**
 * TanStack Query key factory for the syslog module.
 *
 * 所有 key 携带 `projectId`，切换项目自动隔离缓存。Syslog 是只读列表视图，
 * 除 list 外还缓存三个下拉数据源（modules / operationTypes / users）。
 */
export const sysLogKeys = {
  /** 模块根 key。 */
  all: (projectId: string) => ['project', projectId, 'syslog'] as const,

  /** list 查询前缀。 */
  lists: (projectId: string) => [...sysLogKeys.all(projectId), 'list'] as const,

  /** 某组筛选/分页参数下的 list key。 */
  list: (projectId: string, params: SysLogQueryParams) =>
    [...sysLogKeys.lists(projectId), params] as const,

  /** 模块下拉 key。 */
  modules: (projectId: string) => [...sysLogKeys.all(projectId), 'modules'] as const,

  /** 操作类型下拉 key。 */
  operationTypes: (projectId: string) =>
    [...sysLogKeys.all(projectId), 'operationTypes'] as const,

  /** 用户下拉 key。 */
  users: (projectId: string) => [...sysLogKeys.all(projectId), 'users'] as const,
} as const;

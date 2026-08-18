/**
 * LP Portal 补资域 query key factory（kissen-admin 同模式：
 * 一律以 `['project', projectId, <domain>]` 开头做缓存隔离）。
 */
import type { TopupListReq } from './topup.model';

export const topupKeys = {
  all: (projectId: string) => ['project', projectId, 'topup'] as const,
  lists: (projectId: string) => [...topupKeys.all(projectId), 'list'] as const,
  list: (projectId: string, params: TopupListReq) =>
    [...topupKeys.lists(projectId), params] as const,
  /** 资金池下拉选项（topup 页筛选；与 pool 域列表缓存隔离）。 */
  poolOptions: (projectId: string) =>
    [...topupKeys.all(projectId), 'poolOptions'] as const,
} as const;

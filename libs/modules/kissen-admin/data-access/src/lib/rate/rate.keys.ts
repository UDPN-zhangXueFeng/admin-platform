import type { RateListReq } from './rate.model';

/** 加价率变更记录 query key factory（携带 projectId 隔离缓存）。 */
export const rateKeys = {
  all: (projectId: string) => ['project', projectId, 'rate'] as const,
  lists: (projectId: string) => [...rateKeys.all(projectId), 'list'] as const,
  list: (projectId: string, params: RateListReq) =>
    [...rateKeys.lists(projectId), params] as const,
  /** 货币对维度变更记录（变更记录弹窗）。 */
  history: (projectId: string, pairId: number) =>
    [...rateKeys.all(projectId), 'history', pairId] as const,
  /** 单条变更记录（无 detail 端点，列表回查定位）。 */
  detail: (projectId: string, recordId: number) =>
    [...rateKeys.all(projectId), 'detail', recordId] as const,
} as const;

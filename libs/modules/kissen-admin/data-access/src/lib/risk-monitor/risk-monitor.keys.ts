import type { MonitorHitListReq } from './risk-monitor.model';

/** 监控命中 query key factory（携带 projectId 隔离缓存）。 */
export const monitorHitKeys = {
  all: (projectId: string) => ['project', projectId, 'risk-monitor'] as const,
  lists: (projectId: string) =>
    [...monitorHitKeys.all(projectId), 'hit-list'] as const,
  list: (projectId: string, params: MonitorHitListReq) =>
    [...monitorHitKeys.lists(projectId), params] as const,
} as const;

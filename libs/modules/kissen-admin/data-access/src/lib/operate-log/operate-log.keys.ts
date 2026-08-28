import type { OperateLogListReq } from './operate-log.model';

/** 操作日志域 query key factory（携带 projectId 隔离缓存）。 */
export const operateLogKeys = {
  all: (projectId: string) => ['project', projectId, 'operate-log'] as const,
  lists: (projectId: string) =>
    [...operateLogKeys.all(projectId), 'list'] as const,
  list: (
    projectId: string,
    params: { pageNum: number; pageSize: number; filter: OperateLogListReq },
  ) => [...operateLogKeys.lists(projectId), params] as const,
} as const;

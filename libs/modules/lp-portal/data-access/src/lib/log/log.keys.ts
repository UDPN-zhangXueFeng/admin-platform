/**
 * LP 系统操作日志域 query key factory（kissen-admin 同模式：
 * 一律以 `['project', projectId, <domain>]` 开头做缓存隔离）。
 */
import type { LogPageReq } from './log.model';

export const logKeys = {
  all: (projectId: string) => ['project', projectId, 'log'] as const,
  lists: (projectId: string) => [...logKeys.all(projectId), 'list'] as const,
  list: (projectId: string, params: LogPageReq) =>
    [...logKeys.lists(projectId), params] as const,
} as const;

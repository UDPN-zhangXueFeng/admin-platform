/**
 * LP 系统用户域 query key factory（kissen-admin 同模式：
 * 一律以 `['project', projectId, <domain>]` 开头做缓存隔离）。
 */
import type { UserPageReq } from './user.model';

export const userKeys = {
  all: (projectId: string) => ['project', projectId, 'user'] as const,
  lists: (projectId: string) => [...userKeys.all(projectId), 'list'] as const,
  list: (projectId: string, params: UserPageReq) =>
    [...userKeys.lists(projectId), params] as const,
} as const;

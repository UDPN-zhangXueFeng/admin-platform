/** LP 通知域 query key factory（携带 projectId 隔离缓存，pair 域同模式）。 */
export const notificationKeys = {
  all: (projectId: string) => ['project', projectId, 'notification'] as const,
  /** POST /lp/notification/list 固定首页列表（源 onBell 每次 page(1,20)）。 */
  list: (projectId: string) =>
    [...notificationKeys.all(projectId), 'list'] as const,
} as const;

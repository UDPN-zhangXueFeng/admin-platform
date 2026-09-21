'use client';

/**
 * LP 通知域 read-query hook。
 *
 * 源 loadNotifications：onBell 打开抽屉时一次性拉 page(1,20)，失败静默
 * （request.ts 已统一提示）。映射要点：
 * - `enabled` 由抽屉开关驱动：每次 false→true 且数据已 stale（未设 staleTime）
 *   自动重取 —— 与源「每次点铃铛都重拉」一致；关闭期间保留缓存供徽标推导；
 * - `retry: false`：源无重试语义，且重试会令全局拦截器逐次重复 toast。
 */
import { useQuery } from '@tanstack/react-query';

import { getNotificationPage } from './notification.api';
import { notificationKeys } from './notification.keys';

export function useNotificationListQuery(
  projectId: string,
  opts?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: notificationKeys.list(projectId),
    queryFn: ({ signal }) => getNotificationPage({ signal }),
    enabled: opts?.enabled,
    retry: false,
  });
}

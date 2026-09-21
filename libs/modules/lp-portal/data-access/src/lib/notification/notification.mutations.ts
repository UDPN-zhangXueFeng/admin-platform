'use client';

/**
 * LP 通知域 mutation hook（源 onNotifyRead 写操作）。
 *
 * 成功后本地 patch 缓存行 readFlag=1（源 `n.readFlag = 1` 就地翻转的
 * 等价；unreadCount 由该数据推导，徽标随之递减）。失败静默：不发 toast、
 * 不动缓存（源 catch{} 仅吞错；全局拦截器提示与源 request.ts 同一层）。
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { markNotificationRead } from './notification.api';
import { notificationKeys } from './notification.keys';
import type { NotificationRow } from './notification.model';

export function useNotificationMarkReadMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notifyId: number) => markNotificationRead(notifyId),
    onSuccess: (_result, notifyId) => {
      queryClient.setQueryData<readonly NotificationRow[]>(
        notificationKeys.list(projectId),
        (rows) =>
          rows?.map((row) =>
            row.notifyId === notifyId ? { ...row, readFlag: 1 } : row,
          ),
      );
    },
    // onError 有意留空：markRead 失败静默（保真参数），拦截器已统一提示。
  });
}

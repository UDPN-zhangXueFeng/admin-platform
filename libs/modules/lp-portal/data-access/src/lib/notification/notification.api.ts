/**
 * LP 通知域 raw API 层（源 `src/api/notification.ts` 1:1）。
 *
 * 路径经 lp-client baseURL 拼 /lp 前缀（POST /lp/notification/list、
 * POST /lp/notification/read）；lpId 由后端登录域注入，前端不传。
 */
import type { AxiosRequestConfig } from 'axios';

import { lpRequest, type LpPageResult } from '../lp-client';
import type { NotificationRow } from './notification.model';

/** 源固定分页参数（MainLayout onBell → page(1,20)，无翻页 UI）。 */
const PAGE_REQ = { page: { pageNum: 1, pageSize: 20 } } as const;

/**
 * 站内通知首页（body {page:{pageNum,pageSize}}，源 page() 同形）。
 * 返回 rows（total 由后端给出但源只消费 rows，此处同丢弃）。
 */
export function getNotificationPage(
  config?: AxiosRequestConfig,
): Promise<NotificationRow[]> {
  return lpRequest
    .post<LpPageResult<NotificationRow>>('/notification/list', PAGE_REQ, config)
    .then((raw) => raw?.rows ?? []);
}

/** 标记已读（POST /notification/read，body { notifyId }）。 */
export function markNotificationRead(
  notifyId: number,
  config?: AxiosRequestConfig,
): Promise<void> {
  return lpRequest.post('/notification/read', { notifyId }, config);
}
